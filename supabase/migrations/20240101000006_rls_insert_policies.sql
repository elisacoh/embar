-- The original workspaces/workspace_members policies use FOR ALL with USING,
-- which blocks INSERT (USING checks existing rows — no membership exists yet
-- at creation time). Add explicit WITH CHECK policies for INSERT.

-- Allow a user to create a workspace they own
create policy "workspaces_insert" on workspaces
  for insert with check (owner_id = auth.uid());

-- Allow a user to add themselves as a member
create policy "workspace_members_insert" on workspace_members
  for insert with check (user_id = auth.uid());
