-- Folders + pages for the Documents module.
-- Extends the existing public.documents table (native docs).

create table if not exists document_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_id uuid references document_folders(id) on delete set null,
  name text not null default '',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id)
);

alter table documents add column if not exists folder_id uuid references document_folders(id) on delete set null;

create table if not exists document_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  level integer not null default 0 check (level between 0 and 2),
  position integer not null default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id)
);

create index if not exists document_folders_workspace_idx
  on document_folders (workspace_id)
  where deleted_at is null;

create index if not exists document_folders_parent_idx
  on document_folders (parent_id)
  where deleted_at is null;

create index if not exists documents_folder_idx
  on documents (folder_id)
  where deleted_at is null;

create index if not exists document_pages_document_idx
  on document_pages (document_id, position)
  where deleted_at is null;

create index if not exists document_pages_workspace_idx
  on document_pages (workspace_id)
  where deleted_at is null;

alter table document_folders enable row level security;
alter table document_pages enable row level security;

drop policy if exists "document_folders_isolation" on document_folders;
create policy "document_folders_isolation" on document_folders
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

drop policy if exists "document_pages_isolation" on document_pages;
create policy "document_pages_isolation" on document_pages
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

grant select, insert, update, delete on table document_folders to authenticated;
grant select, insert, update, delete on table document_pages to authenticated;
grant select, insert, update, delete on table documents to authenticated;
