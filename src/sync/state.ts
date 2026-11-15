import { create } from 'zustand';
import type { CloudSnapshot } from './supabase';
export type SyncStatus =
  | 'local'
  | 'checking'
  | 'saved'
  | 'pending'
  | 'offline'
  | 'error'
  | 'choose'
  | 'conflict';
export interface SyncState {
  email: string | null;
  status: SyncStatus;
  message: string | null;
  remote: CloudSnapshot | null;
  locked: boolean;
  working: boolean;
  hasRecovery: boolean;
}
export const useSync = create<SyncState>(() => ({
  email: null,
  status: 'local',
  message: null,
  remote: null,
  locked: false,
  working: false,
  hasRecovery: false,
}));
export const SYNC_LABELS: Record<SyncStatus, string> = {
  local: 'Local only',
  checking: 'Syncing…',
  saved: 'Saved to cloud',
  pending: 'Waiting to sync',
  offline: 'Saved locally · Offline',
  error: 'Sync needs attention',
  choose: 'Choose starting copy',
  conflict: 'Sync conflict',
};
