-- Local fields survive type changes. Collections are a many-to-many overlay,
-- not a single document.collection_id. context_entity_id is deferred until Entities.

create or replace function preserve_document_fields_on_type_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.document_type_id is not distinct from old.document_type_id then
    return new;
  end if;

  update document_field_values v
  set
    field_definition_id = null,
    local_field_key = case
      when exists (
        select 1
        from document_field_values existing
        where existing.document_id = v.document_id
          and existing.id is distinct from v.id
          and existing.local_field_key = fd.key
      ) then fd.key || '__' || substr(replace(v.id::text, '-', ''), 1, 8)
      else fd.key
    end,
    updated_at = now()
  from field_definitions fd
  where v.document_id = new.id
    and v.field_definition_id = fd.id
    and (
      new.document_type_id is null
      or fd.document_type_id is distinct from new.document_type_id
    );

  if new.document_type_id is not null then
    update document_field_values v
    set
      field_definition_id = fd.id,
      local_field_key = null,
      updated_at = now()
    from field_definitions fd
    where v.document_id = new.id
      and v.local_field_key = fd.key
      and fd.document_type_id = new.document_type_id
      and not exists (
        select 1
        from document_field_values typed
        where typed.document_id = v.document_id
          and typed.field_definition_id = fd.id
          and typed.id is distinct from v.id
      );
  end if;

  return new;
end;
$$;

drop trigger if exists documents_preserve_fields_on_type_change on documents;
create trigger documents_preserve_fields_on_type_change
  after update of document_type_id on documents
  for each row
  execute function preserve_document_fields_on_type_change();

create or replace function detach_field_values_before_definition_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update document_field_values v
  set
    field_definition_id = null,
    local_field_key = case
      when exists (
        select 1
        from document_field_values existing
        where existing.document_id = v.document_id
          and existing.id is distinct from v.id
          and existing.local_field_key = old.key
      ) then old.key || '__' || substr(replace(v.id::text, '-', ''), 1, 8)
      else old.key
    end,
    updated_at = now()
  where v.field_definition_id = old.id;
  return old;
end;
$$;

drop trigger if exists field_definitions_detach_values on field_definitions;
create trigger field_definitions_detach_values
  before delete on field_definitions
  for each row
  execute function detach_field_values_before_definition_delete();

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null default '',
  parent_collection_id uuid references collections(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (parent_collection_id is distinct from id)
);

create index if not exists collections_workspace_idx
  on collections (workspace_id);

create index if not exists collections_parent_idx
  on collections (parent_collection_id);

create table if not exists document_collections (
  document_id uuid not null references documents(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, collection_id)
);

create index if not exists document_collections_collection_idx
  on document_collections (collection_id);

create or replace function collections_parent_same_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_collection_id is not null then
    if not exists (
      select 1
      from collections parent
      where parent.id = new.parent_collection_id
        and parent.workspace_id = new.workspace_id
    ) then
      raise exception 'parent collection must belong to the same workspace';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists collections_parent_same_workspace on collections;
create trigger collections_parent_same_workspace
  before insert or update of parent_collection_id, workspace_id on collections
  for each row
  execute function collections_parent_same_workspace();

create or replace function document_collections_same_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from documents d
    join collections c on c.id = new.collection_id
    where d.id = new.document_id
      and d.workspace_id = c.workspace_id
  ) then
    raise exception 'document and collection must belong to the same workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists document_collections_same_workspace on document_collections;
create trigger document_collections_same_workspace
  before insert or update on document_collections
  for each row
  execute function document_collections_same_workspace();

alter table collections enable row level security;
alter table document_collections enable row level security;

drop policy if exists "collections_isolation" on collections;
create policy "collections_isolation" on collections
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

drop policy if exists "document_collections_isolation" on document_collections;
create policy "document_collections_isolation" on document_collections
  for all
  to authenticated
  using (
    collection_id in (
      select id from collections
      where workspace_id in (
        select workspace_id from workspace_members where user_id = (select auth.uid())
      )
    )
  )
  with check (
    exists (
      select 1
      from documents d
      join collections c on c.id = collection_id
      where d.id = document_id
        and d.workspace_id = c.workspace_id
        and d.workspace_id in (
          select workspace_id from workspace_members where user_id = (select auth.uid())
        )
    )
  );

grant select, insert, update, delete on table collections to authenticated;
grant select, insert, update, delete on table document_collections to authenticated;
