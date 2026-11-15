-- Run in the Supabase SQL Editor after disabling public signups and creating
-- your single email/password user under Authentication > Users.
-- Idempotent: re-running preserves saved documents and the configured owner.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.spatium_owner (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null unique references auth.users(id)
);
do $$
begin
  if not exists (select 1 from private.spatium_owner) then
    if (select count(*) from auth.users) <> 1 then
      raise exception 'Create exactly one Spatium user in Authentication > Users before running this setup. Disable public signups first.';
    end if;
    insert into private.spatium_owner(owner_id) select id from auth.users;
  end if;
end $$;

create table if not exists public.spatium_documents (
  owner_id uuid primary key references auth.users(id),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.spatium_documents enable row level security;
revoke all on public.spatium_documents from public, anon, authenticated;

create or replace function public.spatium_is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.spatium_owner where owner_id = (select auth.uid()));
$$;
revoke all on function public.spatium_is_owner() from public, anon;
grant execute on function public.spatium_is_owner() to authenticated;

drop policy if exists spatium_owner_read on public.spatium_documents;
create policy spatium_owner_read on public.spatium_documents for select to authenticated
  using (owner_id = (select auth.uid()) and (select public.spatium_is_owner()));
grant select on public.spatium_documents to authenticated;

create or replace function public.spatium_read() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.spatium_is_owner() then raise exception 'Not the configured Spatium owner' using errcode = '42501'; end if;
  select jsonb_build_object('document', document, 'revision', revision) into result
    from public.spatium_documents where owner_id = (select auth.uid());
  return result;
end $$;

-- Poll only this tiny value; download the document when its revision changes.
create or replace function public.spatium_revision() returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare result bigint;
begin
  if not public.spatium_is_owner() then raise exception 'Not the configured Spatium owner' using errcode = '42501'; end if;
  select revision into result from public.spatium_documents where owner_id = (select auth.uid());
  return result;
end $$;

create or replace function public.spatium_save(p_document jsonb, p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.spatium_documents%rowtype; next_revision bigint;
begin
  if not public.spatium_is_owner() then raise exception 'Not the configured Spatium owner' using errcode = '42501'; end if;
  if p_document is null or jsonb_typeof(p_document) <> 'object'
    or jsonb_typeof(p_document->'panels') is distinct from 'object'
    or jsonb_typeof(p_document->'items') is distinct from 'object'
    or jsonb_typeof(p_document->'panelOrder') is distinct from 'array'
    or jsonb_typeof(p_document->'settings') is distinct from 'object'
    or p_document->>'schemaVersion' is distinct from '3' then
    raise exception 'Invalid Spatium document' using errcode = '22023';
  end if;
  -- Serialize initial creation as well as updates; two devices cannot both win.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 1729));
  select * into existing from public.spatium_documents where owner_id = auth.uid() for update;
  if found then
    if p_expected_revision is distinct from existing.revision then raise exception 'Cloud version changed' using errcode = '40001'; end if;
    next_revision := existing.revision + 1;
    update public.spatium_documents set document = p_document, revision = next_revision, updated_at = now() where owner_id = auth.uid();
  else
    if p_expected_revision is not null then raise exception 'Cloud version changed' using errcode = '40001'; end if;
    next_revision := 1;
    insert into public.spatium_documents(owner_id, document, revision) values (auth.uid(), p_document, next_revision);
  end if;
  return jsonb_build_object('document', p_document, 'revision', next_revision);
end $$;
revoke all on function public.spatium_read() from public, anon;
revoke all on function public.spatium_revision() from public, anon;
revoke all on function public.spatium_save(jsonb, bigint) from public, anon;
grant execute on function public.spatium_read() to authenticated;
grant execute on function public.spatium_revision() to authenticated;
grant execute on function public.spatium_save(jsonb, bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
