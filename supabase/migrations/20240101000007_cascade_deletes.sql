alter table public.workspaces
  drop constraint workspaces_owner_id_fkey,
  add constraint workspaces_owner_id_fkey
    foreign key (owner_id)
    references auth.users(id)
    on delete cascade;

alter table public.workspace_members
  drop constraint workspace_members_user_id_fkey,
  add constraint workspace_members_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete cascade;
