-- Optional document types, field definitions, and per-document values.
-- A document with document_type_id null is valid. Null field values are valid.

create table if not exists document_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  system_key text,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (is_system and workspace_id is null and system_key is not null)
    or (not is_system and workspace_id is not null)
  )
);

create unique index if not exists document_types_system_key_idx
  on document_types (system_key)
  where system_key is not null;

create index if not exists document_types_workspace_idx
  on document_types (workspace_id)
  where workspace_id is not null;

create table if not exists field_definitions (
  id uuid primary key default gen_random_uuid(),
  document_type_id uuid not null references document_types(id) on delete cascade,
  key text not null,
  label text not null,
  field_type text not null
    check (field_type in ('text', 'number', 'date', 'boolean', 'single_select', 'multi_select')),
  config jsonb not null default '{}',
  visible_by_default boolean not null default true,
  search_weight integer not null default 0,
  position integer not null default 0,
  unique (document_type_id, key)
);

create index if not exists field_definitions_type_idx
  on field_definitions (document_type_id, position);

create table if not exists document_field_values (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  field_definition_id uuid references field_definitions(id) on delete cascade,
  local_field_key text,
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (field_definition_id is not null and local_field_key is null)
    or (field_definition_id is null and local_field_key is not null)
  ),
  unique (document_id, field_definition_id),
  unique (document_id, local_field_key)
);

create index if not exists document_field_values_document_idx
  on document_field_values (document_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_document_type_id_fkey'
  ) then
    alter table documents
      add constraint documents_document_type_id_fkey
      foreign key (document_type_id) references document_types(id) on delete set null;
  end if;
end $$;

insert into document_types (workspace_id, system_key, name, description, is_system)
values
  (null, 'general_document', 'General Document', 'A free-form document with no required structure.', true),
  (null, 'cv', 'CV', 'Curriculum vitae or resume.', true),
  (null, 'contract', 'Contract', 'Agreement or contract draft.', true),
  (null, 'project_specification', 'Project Specification', 'Product or technical specification.', true),
  (null, 'course_notes', 'Course Notes', 'Notes for a course or study track.', true)
on conflict (system_key) where system_key is not null do nothing;

insert into field_definitions (document_type_id, key, label, field_type, config, visible_by_default, search_weight, position)
select id, 'target_company', 'Target company', 'text', '{}'::jsonb, true, 8, 0 from document_types where system_key = 'cv'
on conflict (document_type_id, key) do nothing;

insert into field_definitions (document_type_id, key, label, field_type, config, visible_by_default, search_weight, position)
select id, 'target_role', 'Target role', 'text', '{}'::jsonb, true, 8, 1 from document_types where system_key = 'cv'
on conflict (document_type_id, key) do nothing;

insert into field_definitions (document_type_id, key, label, field_type, config, visible_by_default, search_weight, position)
select id, 'language', 'Language', 'single_select', '{"options":["English","French","Hebrew"]}'::jsonb, true, 4, 2
from document_types where system_key = 'cv'
on conflict (document_type_id, key) do nothing;

insert into field_definitions (document_type_id, key, label, field_type, config, visible_by_default, search_weight, position)
select id, 'counterparty', 'Counterparty', 'text', '{}'::jsonb, true, 5, 0 from document_types where system_key = 'contract'
on conflict (document_type_id, key) do nothing;

insert into field_definitions (document_type_id, key, label, field_type, config, visible_by_default, search_weight, position)
select id, 'effective_date', 'Effective date', 'date', '{}'::jsonb, true, 3, 1 from document_types where system_key = 'contract'
on conflict (document_type_id, key) do nothing;

insert into field_definitions (document_type_id, key, label, field_type, config, visible_by_default, search_weight, position)
select id, 'status', 'Status', 'single_select', '{"options":["Draft","In review","Signed"]}'::jsonb, true, 4, 2
from document_types where system_key = 'contract'
on conflict (document_type_id, key) do nothing;

insert into field_definitions (document_type_id, key, label, field_type, config, visible_by_default, search_weight, position)
select id, 'project_name', 'Project', 'text', '{}'::jsonb, true, 6, 0 from document_types where system_key = 'project_specification'
on conflict (document_type_id, key) do nothing;

insert into field_definitions (document_type_id, key, label, field_type, config, visible_by_default, search_weight, position)
select id, 'course_name', 'Course', 'text', '{}'::jsonb, true, 6, 0 from document_types where system_key = 'course_notes'
on conflict (document_type_id, key) do nothing;

alter table document_types enable row level security;
alter table field_definitions enable row level security;
alter table document_field_values enable row level security;

drop policy if exists "document_types_select" on document_types;
create policy "document_types_select" on document_types
  for select
  to authenticated
  using (
    is_system
    or workspace_id in (
      select workspace_id from workspace_members where user_id = (select auth.uid())
    )
  );

drop policy if exists "document_types_write" on document_types;
create policy "document_types_write" on document_types
  for all
  to authenticated
  using (
    not is_system
    and workspace_id in (
      select workspace_id from workspace_members where user_id = (select auth.uid())
    )
  )
  with check (
    not is_system
    and workspace_id in (
      select workspace_id from workspace_members where user_id = (select auth.uid())
    )
  );

drop policy if exists "field_definitions_select" on field_definitions;
create policy "field_definitions_select" on field_definitions
  for select
  to authenticated
  using (
    document_type_id in (
      select id from document_types
      where is_system
        or workspace_id in (
          select workspace_id from workspace_members where user_id = (select auth.uid())
        )
    )
  );

drop policy if exists "field_definitions_write" on field_definitions;
create policy "field_definitions_write" on field_definitions
  for all
  to authenticated
  using (
    document_type_id in (
      select id from document_types
      where not is_system
        and workspace_id in (
          select workspace_id from workspace_members where user_id = (select auth.uid())
        )
    )
  )
  with check (
    document_type_id in (
      select id from document_types
      where not is_system
        and workspace_id in (
          select workspace_id from workspace_members where user_id = (select auth.uid())
        )
    )
  );

drop policy if exists "document_field_values_isolation" on document_field_values;
create policy "document_field_values_isolation" on document_field_values
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

grant select on table document_types to authenticated;
grant select, insert, update, delete on table document_types to authenticated;
grant select, insert, update, delete on table field_definitions to authenticated;
grant select, insert, update, delete on table document_field_values to authenticated;
