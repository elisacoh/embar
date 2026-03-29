create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('personal', 'professional', 'project')),
  owner_id uuid references auth.users(id),
  color text,
  icon text,
  sidebar_config jsonb default '[]',
  settings jsonb default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'owner' check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

create table entity_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  description text,
  structure jsonb not null,
  preview_tags text[],
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  color text not null,
  icon text,
  mode text default 'flow' check (mode in ('flow', 'structure')),
  columns jsonb default '[]',
  time_window jsonb default null,
  suppress_outside_window boolean default false,
  ai_summary text,
  ai_categories jsonb default '[]',
  template_id uuid references entity_templates(id),
  position integer default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id)
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  email text[],
  phone text,
  company text,
  role text,
  ai_summary text,
  embedding extensions.vector(1536),
  avg_response_time integer,
  last_contacted timestamptz,
  contact_frequency text check (contact_frequency in ('frequent', 'occasional', 'rare')),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  entity_id uuid references entities(id),
  title text not null,
  type text check (type in ('native', 'pdf', 'file')),
  content text,
  file_path text,
  file_size integer,
  mime_type text,
  ai_summary text,
  embedding extensions.vector(1536),
  extracted_text text,
  status text default 'active' check (status in ('active', 'archived')),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  entity_id uuid references entities(id),
  title text not null,
  type text default 'batch' check (type in ('batch', 'worksheet', 'focus_session')),
  document_id uuid references documents(id),
  scheduled_date date not null,
  scheduled_time time,
  duration_estimate integer,
  duration_actual integer,
  status text default 'pending' check (status in ('pending', 'active', 'completed', 'partial')),
  batch_size integer,
  total_units integer,
  completed_units integer default 0,
  ai_summary text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  entity_id uuid references entities(id),
  title text not null,
  description text,
  subtasks jsonb default '[]',
  state text default 'unplanned' check (
    state in ('focus', 'planned', 'carry-on', 'unplanned', 'someday', 'done')
  ),
  scheduled_date date,
  scheduled_time time,
  duration_estimate integer,
  duration_actual integer,
  is_fixed boolean default false,
  due_date date,
  due_time time,
  hard_deadline boolean default false,
  urgency text default 'normal' check (urgency in ('critical', 'urgent', 'normal')),
  work_type text check (work_type in ('deep', 'shallow', 'admin')),
  ai_category text,
  ai_summary text,
  embedding extensions.vector(1536),
  waiting_for uuid references contacts(id),
  waiting_since timestamptz,
  stale_threshold integer default 48,
  is_recurring boolean default false,
  recurrence_rule jsonb default null,
  recurrence_parent_id uuid references items(id),
  session_id uuid references sessions(id),
  position integer default 0,
  completed_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id)
);

create table item_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  item_id uuid references items(id) on delete cascade,
  target_type text check (target_type in ('item', 'email', 'document', 'contact')),
  target_id uuid not null,
  relationship text check (
    relationship in ('related_to', 'blocked_by', 'created_from', 'supported_by')
  ),
  source text default 'user' check (source in ('user', 'ai')),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  unique(item_id, target_type, target_id)
);

create table entity_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  entity_id uuid references entities(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  relationship text check (
    relationship in ('client', 'colleague', 'vendor', 'staff', 'manager')
  ),
  is_primary boolean default false,
  created_at timestamptz default now(),
  unique(entity_id, contact_id)
);

create table emails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  entity_id uuid references entities(id),
  contact_id uuid references contacts(id),
  external_id text not null,
  provider text check (provider in ('gmail', 'outlook')),
  thread_id text,
  subject text,
  sender_email text not null,
  sender_name text,
  recipient_emails text[],
  body_text text,
  body_html text,
  received_at timestamptz not null,
  ai_category text check (
    ai_category in ('priorities', 'to_handle', 'informational', 'newsletter')
  ),
  ai_summary text,
  urgency text default 'normal' check (urgency in ('critical', 'urgent', 'normal')),
  embedding extensions.vector(1536),
  status text default 'unread' check (
    status in ('unread', 'read', 'replied', 'archived')
  ),
  requires_reply boolean default false,
  tags text[] default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(workspace_id, external_id)
);

create table automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  entity_id uuid references entities(id),
  name text not null,
  is_active boolean default true,
  trigger_type text check (trigger_type in ('schedule', 'event', 'condition')),
  trigger_config jsonb not null,
  action_type text check (
    action_type in ('send_email', 'create_item', 'notify', 'update_item')
  ),
  action_config jsonb not null,
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_count integer default 0,
  error_count integer default 0,
  created_from_prompt text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id)
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  entity_id uuid references entities(id),
  name text not null,
  goal text not null,
  is_active boolean default true,
  status text default 'idle' check (
    status in ('idle', 'running', 'waiting', 'completed', 'error')
  ),
  memory jsonb default '{}',
  report_frequency text default 'on_action',
  allowed_tools text[] default '{}',
  created_from_prompt text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id),
  action_type text check (action_type in (
    'item_completed', 'item_deferred', 'ai_suggestion_accepted',
    'ai_suggestion_rejected', 'ai_bar_query', 'context_switched',
    'email_replied', 'entity_opened', 'session_started'
  )),
  object_type text check (
    object_type in ('item', 'email', 'document', 'entity', 'session')
  ),
  object_id uuid,
  context jsonb default '{}',
  ai_suggestion jsonb default null,
  duration_ms integer,
  occurred_at timestamptz default now()
);
