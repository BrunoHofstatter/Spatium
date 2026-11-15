import { createClient } from '@supabase/supabase-js';
import { migrate } from '../model/persistence';
import { cloudDocument } from './document';
import type { Doc } from '../model/types';
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://pfomcrdvmrrufutppuwl.supabase.co';
// This is a public browser key. SQL policies, authentication and the owner allowlist protect the document.
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_nFMnetHp5Ple7CX65PCFWw_mCR1qhmJ';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storageKey: 'spatium-auth', detectSessionInUrl: false },
});
export interface CloudSnapshot {
  document: Doc;
  revision: number;
}
export class CloudConflict extends Error {}
export interface CloudRepository {
  read(): Promise<CloudSnapshot | null>;
  write(document: Doc, expected: number | null): Promise<CloudSnapshot>;
}
function snapshot(raw: unknown): CloudSnapshot | null {
  if (raw === null) return null;
  const row = raw as { document?: unknown; revision?: number };
  if (!row || !Number.isSafeInteger(row.revision) || row.revision! < 1)
    throw new Error('The cloud returned an invalid saved version.');
  return { document: migrate(row.document), revision: row.revision! };
}
function message(error: { code?: string; message: string }): Error {
  if (error.code === '40001')
    return new CloudConflict('A newer cloud version is available.');
  if (error.code === 'PGRST202' || error.code === '42P01')
    return new Error(
      'Cloud setup is not installed yet. Apply the Supabase setup SQL, then try again.',
    );
  if (error.code === '42501')
    return new Error(
      'This account is not the configured Spatium owner. Check the Supabase owner setup.',
    );
  return new Error(error.message);
}
export class SupabaseRepository implements CloudRepository {
  private cached: CloudSnapshot | null = null;
  async read() {
    const version = await supabase.rpc('spatium_revision');
    if (version.error) throw message(version.error);
    if (version.data === null) {
      this.cached = null;
      return null;
    }
    if (this.cached?.revision === version.data) return this.cached;
    const { data, error } = await supabase.rpc('spatium_read');
    if (error) throw message(error);
    this.cached = snapshot(data);
    return this.cached;
  }
  async write(document: Doc, expected: number | null) {
    const { data, error } = await supabase.rpc('spatium_save', {
      p_document: cloudDocument(document),
      p_expected_revision: expected,
    });
    if (error) throw message(error);
    const result = snapshot(data);
    if (!result) throw new Error('The cloud did not confirm this save.');
    this.cached = result;
    return result;
  }
}
