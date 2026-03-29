alter table workspaces enable row level security;
create policy "workspaces_isolation" on workspaces for all using (id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table workspace_members enable row level security;
create policy "workspace_members_isolation" on workspace_members for all using (user_id = auth.uid());

alter table entities enable row level security;
create policy "entities_isolation" on entities for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table entity_templates enable row level security;
create policy "entity_templates_isolation" on entity_templates for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table items enable row level security;
create policy "items_isolation" on items for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table item_links enable row level security;
create policy "item_links_isolation" on item_links for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table contacts enable row level security;
create policy "contacts_isolation" on contacts for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table entity_contacts enable row level security;
create policy "entity_contacts_isolation" on entity_contacts for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table documents enable row level security;
create policy "documents_isolation" on documents for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table emails enable row level security;
create policy "emails_isolation" on emails for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table sessions enable row level security;
create policy "sessions_isolation" on sessions for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table automations enable row level security;
create policy "automations_isolation" on automations for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table agents enable row level security;
create policy "agents_isolation" on agents for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

alter table interactions enable row level security;
create policy "interactions_isolation" on interactions for all using (user_id = auth.uid());
