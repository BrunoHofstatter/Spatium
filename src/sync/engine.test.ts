import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument, useStore } from '../model/store';
import type { Doc } from '../model/types';
import {
  SyncEngine,
  SYNC_KEY,
  type Checkpoint,
  type DeviceStorage,
} from './engine';
import {
  CloudConflict,
  type CloudRepository,
  type CloudSnapshot,
} from './supabase';
import { cloudDocument, deviceDocument, fingerprint } from './document';
import { useSync } from './state';

class Device implements DeviceStorage {
  metadata: Checkpoint | undefined;
  writes = 0;
  async readMetadata<T>() {
    return structuredClone(this.metadata) as T | undefined;
  }
  async writeMetadata(_key: string, value: unknown) {
    this.metadata = structuredClone(value) as Checkpoint;
  }
  async replace(doc: Doc, key: string, value: unknown) {
    ++this.writes;
    expect(key).toBe(SYNC_KEY);
    await this.writeMetadata(key, value);
    this.persisted = structuredClone(doc);
  }
  persisted: Doc | undefined;
}
class Cloud implements CloudRepository {
  value: CloudSnapshot | null = null;
  writes = 0;
  fail = false;
  loseResponse = false;
  beforeRead?: () => void;
  async read() {
    if (this.fail) throw new Error('Network unavailable');
    this.beforeRead?.();
    return structuredClone(this.value);
  }
  async write(doc: Doc, expected: number | null) {
    if (this.fail) throw new Error('Network unavailable');
    if ((this.value?.revision ?? null) !== expected) throw new CloudConflict();
    ++this.writes;
    this.value = {
      document: cloudDocument(doc),
      revision: (this.value?.revision ?? 0) + 1,
    };
    if (this.loseResponse) {
      this.loseResponse = false;
      throw new Error('Connection dropped after save');
    }
    return structuredClone(this.value);
  }
}
const store = () => useStore.getState();
function changed(doc: Doc, title: string): Doc {
  const next = structuredClone(doc);
  next.panels[next.panelOrder[0]].title = title;
  return next;
}
beforeEach(() => {
  vi.useFakeTimers();
  store().hydrate(createDocument());
  useSync.setState({
    email: null,
    status: 'local',
    remote: null,
    message: null,
    working: false,
    locked: false,
    hasRecovery: false,
  });
});
afterEach(() => vi.useRealTimers());
describe('whole-document cloud sync', () => {
  it('requires an explicit first upload and never publishes local work on login alone', async () => {
    const device = new Device(),
      cloud = new Cloud(),
      engine = new SyncEngine(device, { flush: async () => {} }, cloud);
    await engine.connect('owner', 'owner@example.com');
    expect(useSync.getState().status).toBe('choose');
    expect(cloud.writes).toBe(0);
    await engine.choose('local');
    expect(cloud.writes).toBe(1);
    expect(device.metadata?.revision).toBe(1);
    expect(useSync.getState().status).toBe('saved');
  });
  it('loads an existing cloud copy on a fresh device without uploading its empty default', async () => {
    const device = new Device(),
      cloud = new Cloud();
    cloud.value = {
      document: changed(createDocument(), 'From PC'),
      revision: 4,
    };
    const engine = new SyncEngine(device, { flush: async () => {} }, cloud);
    await engine.connect('owner', 'owner@example.com');
    expect(store().doc.panels[store().doc.panelOrder[0]].title).toBe('From PC');
    expect(cloud.writes).toBe(0);
    expect(device.metadata?.revision).toBe(4);
  });
  it('offers both existing copies, archives them, and restores a recovery copy safely', async () => {
    store().renamePanel(store().doc.panelOrder[0], 'Existing phone');
    const device = new Device(),
      cloud = new Cloud();
    cloud.value = {
      document: changed(createDocument(), 'Existing PC'),
      revision: 2,
    };
    const engine = new SyncEngine(device, { flush: async () => {} }, cloud);
    await engine.connect('owner', 'owner@example.com');
    expect(useSync.getState().status).toBe('choose');
    await engine.choose('cloud');
    expect(engine.recovery()).toHaveLength(2);
    expect(store().doc.panels[store().doc.panelOrder[0]].title).toBe(
      'Existing PC',
    );
    await engine.restore(engine.recovery()[0].id);
    expect(store().doc.panels[store().doc.panelOrder[0]].title).toBe(
      'Existing phone',
    );
    expect(useSync.getState().status).toBe('conflict');
    expect(cloud.writes).toBe(0);
  });
  it('detects concurrent/offline changes after a reload and never silently overwrites the cloud', async () => {
    const original = store().doc,
      device = new Device(),
      cloud = new Cloud();
    device.metadata = {
      ownerId: 'owner',
      revision: 1,
      base: fingerprint(original),
      recovery: [],
    };
    cloud.value = { document: changed(original, 'PC changed'), revision: 2 };
    store().hydrate(changed(original, 'Phone offline edit'));
    const engine = new SyncEngine(device, { flush: async () => {} }, cloud);
    await engine.connect('owner', 'owner@example.com');
    expect(useSync.getState().status).toBe('conflict');
    expect(cloud.writes).toBe(0);
    expect(store().doc.panels[original.panelOrder[0]].title).toBe(
      'Phone offline edit',
    );
    await engine.choose('local');
    expect(cloud.value?.revision).toBe(3);
    expect(engine.recovery()).toHaveLength(2);
  });
  it('checks the cloud again before honoring a conflict choice', async () => {
    store().renamePanel(store().doc.panelOrder[0], 'Phone');
    const device = new Device(),
      cloud = new Cloud();
    cloud.value = { document: changed(createDocument(), 'PC'), revision: 2 };
    const engine = new SyncEngine(device, { flush: async () => {} }, cloud);
    await engine.connect('owner', 'owner@example.com');
    cloud.value = {
      document: changed(cloud.value.document, 'PC newer again'),
      revision: 3,
    };
    await engine.choose('local');
    expect(cloud.writes).toBe(0);
    expect(useSync.getState().remote?.revision).toBe(3);
    expect(useSync.getState().status).toBe('conflict');
  });
  it('recognizes a committed upload when only the response was lost', async () => {
    const device = new Device(),
      cloud = new Cloud(),
      engine = new SyncEngine(device, { flush: async () => {} }, cloud);
    await engine.connect('owner', 'owner@example.com');
    cloud.loseResponse = true;
    await engine.choose('local');
    expect(useSync.getState().status).toBe('error');
    await engine.run();
    expect(cloud.writes).toBe(1);
    expect(useSync.getState().status).toBe('saved');
    expect(device.metadata?.revision).toBe(1);
  });
  it('retains local edits while offline and resumes after reconnection', async () => {
    const device = new Device(),
      cloud = new Cloud(),
      engine = new SyncEngine(device, { flush: async () => {} }, cloud);
    await engine.connect('owner', 'owner@example.com');
    await engine.choose('local');
    cloud.fail = true;
    store().renamePanel(store().doc.panelOrder[0], 'Offline title');
    await engine.run();
    expect(cloud.writes).toBe(1);
    cloud.fail = false;
    await engine.run();
    expect(cloud.value?.document.panels[store().doc.panelOrder[0]].title).toBe(
      'Offline title',
    );
  });
  it('does not replace text being edited or an edit completed during a pull', async () => {
    const device = new Device(),
      cloud = new Cloud(),
      original = store().doc;
    device.metadata = {
      ownerId: 'owner',
      revision: 1,
      base: fingerprint(original),
      recovery: [],
    };
    cloud.value = { document: changed(original, 'Remote'), revision: 2 };
    let allowed = false;
    const engine = new SyncEngine(
      device,
      { flush: async () => {} },
      cloud,
      () => allowed,
    );
    await engine.connect('owner', 'owner@example.com');
    expect(device.writes).toBe(0);
    allowed = true;
    cloud.beforeRead = () => {
      store().renamePanel(original.panelOrder[0], 'Just edited');
    };
    await engine.run();
    expect(device.writes).toBe(0);
    expect(useSync.getState().status).toBe('conflict');
  });
  it('keeps device views out of cloud equality and preserves them when pulling', () => {
    const doc = store().doc,
      id = doc.panelOrder[0],
      remote = structuredClone(doc);
    remote.panels[id].viewport = { x: 9, y: 10, zoom: 2 };
    expect(fingerprint(remote)).toBe(fingerprint(doc));
    expect(deviceDocument(remote, doc).panels[id].viewport).toEqual(
      doc.panels[id].viewport,
    );
    const reordered = {
      settings: doc.settings,
      items: doc.items,
      panelOrder: doc.panelOrder,
      panels: doc.panels,
      schemaVersion: doc.schemaVersion,
    };
    expect(fingerprint(reordered)).toBe(fingerprint(doc));
  });
  it('does not upload the previous account’s local work to a different account', async () => {
    const device = new Device(),
      cloud = new Cloud();
    device.metadata = {
      ownerId: 'first-owner',
      revision: 1,
      base: fingerprint(store().doc),
      recovery: [],
    };
    const engine = new SyncEngine(device, { flush: async () => {} }, cloud);
    await engine.connect('second-owner', 'other@example.com');
    await engine.run();
    expect(cloud.writes).toBe(0);
    expect(useSync.getState().message).toContain('different Spatium account');
  });
});
