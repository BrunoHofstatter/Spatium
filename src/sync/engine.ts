import type { Doc } from '../model/types';
import { useStore } from '../model/store';
import { migrate, type PersistenceHandle } from '../model/persistence';
import {
  CloudConflict,
  type CloudRepository,
  type CloudSnapshot,
} from './supabase';
import { deviceDocument, fingerprint, hasWork } from './document';
import { useSync } from './state';

export const SYNC_KEY = 'spatium-cloud-checkpoint';
export interface RecoveryCopy {
  id: string;
  at: number;
  document: Doc;
  label: string;
}
export interface Checkpoint {
  ownerId: string;
  revision: number | null;
  base: string | null;
  recovery: RecoveryCopy[];
}
export interface DeviceStorage {
  readMetadata<T>(key: string): Promise<T | undefined>;
  writeMetadata(key: string, value: unknown): Promise<void>;
  replace(document: Doc, key: string, value: unknown): Promise<void>;
}
export class SyncEngine {
  private checkpoint: Checkpoint | undefined;
  private account: string | null = null;
  private busy = false;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pausedForChoice = false;
  constructor(
    private device: DeviceStorage,
    private persistence: Pick<PersistenceHandle, 'flush'>,
    private cloud: CloudRepository,
    private canApply: () => boolean = () => true,
  ) {}

  async connect(ownerId: string, email: string) {
    if (this.account === ownerId) return;
    const generation = ++this.generation;
    this.account = ownerId;
    this.pausedForChoice = false;
    this.checkpoint = undefined;
    clearTimeout(this.timer);
    useSync.setState({
      email,
      status: 'checking',
      message: null,
      remote: null,
    });
    try {
      const checkpoint = await this.device.readMetadata<Checkpoint>(SYNC_KEY);
      if (generation !== this.generation) return;
      if (checkpoint && checkpoint.ownerId !== ownerId)
        throw new Error(
          'This device is linked to a different Spatium account. Sign in with its original account to keep the saved work separate.',
        );
      if (
        checkpoint &&
        (!Array.isArray(checkpoint.recovery) ||
          (checkpoint.base !== null && typeof checkpoint.base !== 'string') ||
          (checkpoint.revision !== null &&
            !Number.isSafeInteger(checkpoint.revision)))
      )
        throw new Error(
          'The local sync checkpoint could not be read. Your saved work has been left intact.',
        );
      this.checkpoint = checkpoint ?? {
        ownerId,
        revision: null,
        base: null,
        recovery: [],
      };
      useSync.setState({ hasRecovery: this.checkpoint.recovery.length > 0 });
      await this.run();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  disconnect() {
    ++this.generation;
    this.account = null;
    clearTimeout(this.timer);
    this.pausedForChoice = false;
    useSync.setState({
      email: null,
      status: 'local',
      message: null,
      remote: null,
      locked: false,
    });
  }
  changed() {
    if (!this.account || !this.checkpoint || useSync.getState().locked) return;
    if (this.pausedForChoice) return;
    if (fingerprint(useStore.getState().doc) !== this.checkpoint.base)
      useSync.setState({ status: 'pending' });
    this.schedule();
  }
  private schedule(delay = 1000) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), delay);
  }
  async run() {
    if (!this.account || !this.checkpoint || this.busy) return;
    if (
      this.pausedForChoice &&
      ['choose', 'conflict'].includes(useSync.getState().status)
    )
      return;
    this.pausedForChoice = false;
    const generation = this.generation;
    this.busy = true;
    useSync.setState({ working: true });
    try {
      const remote = await this.cloud.read();
      if (generation !== this.generation) return;
      const doc = useStore.getState().doc,
        local = fingerprint(doc),
        remotePrint = remote && fingerprint(remote.document);
      if (remote && local === remotePrint) {
        await this.ack(remote);
        return;
      }
      if (this.checkpoint.base === null) {
        if (remote && !hasWork(doc)) {
          await this.apply(remote, false);
          return;
        }
        this.choice('choose', remote);
        return;
      }
      if (!remote || remote.revision !== this.checkpoint.revision) {
        if (remote && local === this.checkpoint.base)
          await this.apply(remote, false);
        else this.choice('conflict', remote);
        return;
      }
      if (local === this.checkpoint.base) {
        this.status();
        return;
      }
      await this.persistence.flush();
      if (generation !== this.generation) return;
      const snapshot = useStore.getState().doc;
      const saved = await this.cloud.write(snapshot, this.checkpoint.revision);
      if (generation === this.generation) await this.ack(saved);
    } catch (error) {
      if (generation === this.generation) {
        if (error instanceof CloudConflict) this.schedule(0);
        else this.fail(error);
      }
    } finally {
      this.busy = false;
      useSync.setState({ working: false });
    }
  }
  private status() {
    if (!this.account || !this.checkpoint) return;
    const dirty = fingerprint(useStore.getState().doc) !== this.checkpoint.base;
    useSync.setState({
      status: dirty ? 'pending' : 'saved',
      message: null,
      remote: null,
    });
    if (dirty) this.schedule();
  }
  private async ack(remote: CloudSnapshot) {
    if (
      this.checkpoint?.revision === remote.revision &&
      this.checkpoint.base === fingerprint(remote.document)
    ) {
      this.pausedForChoice = false;
      this.status();
      return;
    }
    const next = {
      ...this.checkpoint!,
      revision: remote.revision,
      base: fingerprint(remote.document),
    };
    await this.device.writeMetadata(SYNC_KEY, next);
    this.checkpoint = next;
    this.pausedForChoice = false;
    this.status();
  }
  private choice(status: 'choose' | 'conflict', remote: CloudSnapshot | null) {
    this.pausedForChoice = true;
    useSync.setState({ status, remote, message: null });
  }
  private fail(error: unknown) {
    useSync.setState({
      status:
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'offline'
          : 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Cloud sync is unavailable. Changes remain saved on this device.',
    });
  }
  private archive(local: Doc, remote: CloudSnapshot | null): Checkpoint {
    const at = Date.now();
    const copies: RecoveryCopy[] = [
      {
        id: crypto.randomUUID(),
        at,
        document: local,
        label: 'Device copy before choosing',
      },
    ];
    if (remote)
      copies.push({
        id: crypto.randomUUID(),
        at,
        document: remote.document,
        label: 'Cloud copy before choosing',
      });
    return {
      ...this.checkpoint!,
      recovery: [...copies, ...this.checkpoint!.recovery].slice(0, 12),
    };
  }
  private async apply(remote: CloudSnapshot, archive: boolean) {
    if (!archive && !this.canApply()) {
      useSync.setState({
        status: 'pending',
        message: 'New cloud changes will load when you finish editing.',
      });
      this.schedule();
      return;
    }
    const generation = this.generation;
    useSync.setState({ locked: true });
    try {
      await this.persistence.flush();
      if (generation !== this.generation) return;
      // Recheck after waiting for the local save: an edit may have completed during the request.
      const local = useStore.getState().doc;
      if (
        !archive &&
        hasWork(local) &&
        fingerprint(local) !== this.checkpoint!.base
      ) {
        this.choice('conflict', remote);
        return;
      }
      const document = deviceDocument(remote.document, local);
      const next = {
        ...(archive ? this.archive(local, remote) : this.checkpoint!),
        revision: remote.revision,
        base: fingerprint(remote.document),
      };
      await this.device.replace(document, SYNC_KEY, next);
      if (generation !== this.generation) return;
      this.checkpoint = next;
      useStore.getState().hydrate(document);
      this.pausedForChoice = false;
      useSync.setState({ hasRecovery: next.recovery.length > 0 });
      this.status();
    } finally {
      useSync.setState({ locked: false });
    }
  }
  async choose(which: 'local' | 'cloud') {
    if (this.busy || !this.account || !this.checkpoint) return;
    const generation = this.generation,
      expected = useSync.getState().remote?.revision ?? null;
    this.busy = true;
    useSync.setState({ working: true, locked: true });
    try {
      await this.persistence.flush();
      const remote = await this.cloud.read();
      if (generation !== this.generation) return;
      if ((remote?.revision ?? null) !== expected) {
        this.choice('conflict', remote);
        return;
      }
      if (which === 'cloud') {
        if (!remote)
          throw new Error(
            'There is no cloud copy yet. Choose this device to create it.',
          );
        await this.apply(remote, true);
      } else {
        const local = useStore.getState().doc;
        const checkpoint = this.archive(local, remote);
        await this.device.writeMetadata(SYNC_KEY, checkpoint);
        this.checkpoint = checkpoint;
        useSync.setState({ hasRecovery: true });
        const saved = await this.cloud.write(local, remote?.revision ?? null);
        if (generation === this.generation) await this.ack(saved);
      }
    } catch (error) {
      if (generation === this.generation) {
        if (error instanceof CloudConflict)
          this.choice('conflict', await this.cloud.read().catch(() => null));
        else this.fail(error);
      }
    } finally {
      this.busy = false;
      useSync.setState({ locked: false, working: false });
    }
  }
  recovery(): RecoveryCopy[] {
    return this.checkpoint?.recovery ?? [];
  }
  async restore(id: string) {
    if (!this.checkpoint || this.busy) return;
    const copy = this.checkpoint.recovery.find((c) => c.id === id);
    if (!copy) return;
    this.busy = true;
    useSync.setState({ locked: true, working: true });
    try {
      await this.persistence.flush();
      const current = useStore.getState().doc,
        next = this.archive(current, null);
      const document = deviceDocument(migrate(copy.document), current);
      await this.device.replace(document, SYNC_KEY, next);
      this.checkpoint = next;
      useStore.getState().hydrate(document);
      this.choice('conflict', null);
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy = false;
      useSync.setState({ locked: false, working: false });
    }
  }
}
