import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { createDocument } from '../model/store';
import { legacyFixture } from '../model/legacy.fixture';

it('enforces the single owner, private reads, atomic versions, and idempotent setup in PostgreSQL', async () => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111',
    other = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('${owner}');`);
    const sql = await readFile(
      new URL('../../supabase/setup.sql', import.meta.url),
      'utf8',
    );
    await db.exec(sql);
    await db.exec(sql);
    await db.exec(`set role anon;`);
    await expect(
      db.query('select public.spatium_read()'),
    ).rejects.toMatchObject({ code: '42501' });
    await db.exec(
      `reset role; insert into auth.users values ('${other}'); set role authenticated; set request.jwt.claim.sub = '${other}';`,
    );
    await expect(
      db.query('select public.spatium_read()'),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query('select public.spatium_save($1::jsonb, null)', [
        JSON.stringify(createDocument()),
      ]),
    ).rejects.toMatchObject({ code: '42501' });
    await db.exec(`set request.jwt.claim.sub = '${owner}';`);
    const doc = createDocument();
    await expect(
      db.query('select public.spatium_save($1::jsonb, null)', [
        JSON.stringify({ ...doc, schemaVersion: 3 }),
      ]),
    ).rejects.toMatchObject({ code: '22023' });
    const initial = await db.query<{ saved: { revision: number } }>(
      'select public.spatium_save($1::jsonb, null) as saved',
      [JSON.stringify(doc)],
    );
    expect(initial.rows[0].saved.revision).toBe(1);
    await expect(
      db.query('select public.spatium_save($1::jsonb, null)', [
        JSON.stringify(doc),
      ]),
    ).rejects.toMatchObject({ code: '40001' });
    await expect(
      db.query('update public.spatium_documents set revision = 99'),
    ).rejects.toMatchObject({ code: '42501' });
    const second = await db.query<{ saved: { revision: number } }>(
      'select public.spatium_save($1::jsonb, 1) as saved',
      [JSON.stringify(doc)],
    );
    expect(second.rows[0].saved.revision).toBe(2);
    await expect(
      db.query('select public.spatium_save($1::jsonb, 1)', [
        JSON.stringify(doc),
      ]),
    ).rejects.toMatchObject({ code: '40001' });
    await db.exec(`set request.jwt.claim.sub = '${other}';`);
    expect(
      (await db.query('select * from public.spatium_documents')).rows,
    ).toHaveLength(0);
    await db.exec('reset role;');
    await db.exec(sql);
    expect(
      (await db.query('select revision from public.spatium_documents')).rows,
    ).toEqual([{ revision: 2 }]);
  } finally {
    await db.close();
  }
}, 30000);

it('pins the pre-grid cloud document and rejects old clients without changing its writing', async () => {
  const db = new PGlite(),
    owner = '11111111-1111-4111-8111-111111111111',
    raw = legacyFixture();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon; insert into auth.users values ('${owner}');`,
    );
    const sql = await readFile(
      new URL('../../supabase/setup.sql', import.meta.url),
      'utf8',
    );
    await db.exec(sql);
    await db.query(
      'insert into public.spatium_documents(owner_id,document,revision) values ($1,$2::jsonb,9)',
      [owner, JSON.stringify(raw)],
    );
    await db.exec(sql);
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${owner}';`,
    );
    await expect(
      db.query('select * from private.spatium_grid_backup'),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query('select public.spatium_save($1::jsonb,9)', [
        JSON.stringify(raw),
      ]),
    ).rejects.toMatchObject({ code: '22023' });
    await db.query('select public.spatium_save($1::jsonb,9)', [
      JSON.stringify(createDocument()),
    ]);
    await db.exec('reset role;');
    await db.exec(sql);
    expect(
      (
        await db.query<{ document: unknown; revision: number }>(
          'select document,revision from private.spatium_grid_backup',
        )
      ).rows,
    ).toEqual([{ document: raw, revision: 9 }]);
  } finally {
    await db.close();
  }
}, 30000);
