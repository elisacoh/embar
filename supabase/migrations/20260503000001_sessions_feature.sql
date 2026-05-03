-- marks items that only exist within a session (excluded from regular task views)
alter table items add column if not exists session_origin text
  check (session_origin is null or session_origin = 'light');

-- soft-delete support (consistent with other tables)
alter table sessions add column if not exists deleted_at timestamptz;

-- junction: link existing real tasks to sessions without moving/modifying them
create table if not exists session_items (
  id         uuid        primary key default gen_random_uuid(),
  session_id uuid        not null references sessions(id)  on delete cascade,
  item_id    uuid        not null references items(id)     on delete cascade,
  position   integer     not null default 0,
  created_at timestamptz not null default now(),
  unique(session_id, item_id)
);

create index if not exists idx_session_items_session on session_items(session_id);

alter table session_items enable row level security;
create policy "session_items_isolation" on session_items
  for all using (
    session_id in (
      select id from sessions
      where workspace_id in (
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );
