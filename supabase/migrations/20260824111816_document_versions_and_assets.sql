-- Immutable document snapshots + file metadata (blobs live in Storage).

create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  parent_version_id uuid references document_versions(id) on delete set null,
  version_number integer not null,
  content jsonb not null,
  content_hash text not null,
  label text,
  highlighted boolean not null default false,
  source text not null default 'manual'
    check (source in ('manual', 'export', 'import', 'restore', 'copy_source', 'system')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create unique index if not exists document_versions_number_idx
  on document_versions (document_id, version_number);

create index if not exists document_versions_document_idx
  on document_versions (document_id, created_at desc);

create index if not exists document_versions_highlighted_idx
  on document_versions (document_id)
  where highlighted = true;

create table if not exists document_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  document_version_id uuid references document_versions(id) on delete set null,
  asset_type text not null default 'attachment'
    check (asset_type in ('original_docx', 'pdf_export', 'uploaded_pdf', 'image', 'attachment')),
  filename text not null,
  mime_type text not null default 'application/octet-stream',
  storage_key text not null unique,
  content_hash text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists document_assets_document_idx
  on document_assets (document_id, created_at desc);

alter table document_versions enable row level security;
alter table document_assets enable row level security;

drop policy if exists "document_versions_select" on document_versions;
create policy "document_versions_select" on document_versions
  for select
  to authenticated
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = (select auth.uid())
    )
  );

drop policy if exists "document_versions_insert" on document_versions;
create policy "document_versions_insert" on document_versions
  for insert
  to authenticated
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = (select auth.uid())
    )
  );

drop policy if exists "document_versions_update" on document_versions;
create policy "document_versions_update" on document_versions
  for update
  to authenticated
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = (select auth.uid())
    )
  )
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = (select auth.uid())
    )
  );

drop policy if exists "document_assets_isolation" on document_assets;
create policy "document_assets_isolation" on document_assets
  for all
  to authenticated
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = (select auth.uid())
    )
  )
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = (select auth.uid())
    )
  );

create or replace function document_versions_protect_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'document_versions rows cannot be deleted';
  end if;

  if new.document_id is distinct from old.document_id
    or new.parent_version_id is distinct from old.parent_version_id
    or new.version_number is distinct from old.version_number
    or new.content is distinct from old.content
    or new.content_hash is distinct from old.content_hash
    or new.label is distinct from old.label
    or new.source is distinct from old.source
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.workspace_id is distinct from old.workspace_id
  then
    raise exception 'document_versions rows are immutable except highlighted';
  end if;

  return new;
end;
$$;

drop trigger if exists document_versions_immutable on document_versions;
create trigger document_versions_immutable
  before update or delete on document_versions
  for each row
  execute function document_versions_protect_immutable();

grant select, insert, update on table document_versions to authenticated;
grant select, insert, update, delete on table document_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('document-assets', 'document-assets', false, 26214400)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "document_assets_storage_select" on storage.objects;
create policy "document_assets_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'document-assets'
  and split_part(name, '/', 1) in (
    select workspace_id::text from workspace_members where user_id = (select auth.uid())
  )
);

drop policy if exists "document_assets_storage_insert" on storage.objects;
create policy "document_assets_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'document-assets'
  and split_part(name, '/', 1) in (
    select workspace_id::text from workspace_members where user_id = (select auth.uid())
  )
);

drop policy if exists "document_assets_storage_delete" on storage.objects;
create policy "document_assets_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'document-assets'
  and split_part(name, '/', 1) in (
    select workspace_id::text from workspace_members where user_id = (select auth.uid())
  )
);
