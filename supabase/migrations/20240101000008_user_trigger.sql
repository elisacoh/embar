-- Automatically create a default workspace when a new auth user is created.
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS.
-- Uses RETURNING to avoid a second lookup and keep both inserts atomic.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  insert into public.workspaces (id, name, type, owner_id)
  values (gen_random_uuid(), 'My Workspace', 'personal', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();