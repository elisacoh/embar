-- ============================================================
-- Embar Migration 005 — created_by SET NULL on user delete
-- ============================================================
-- workspace_id cascades handle owned data.
-- created_by columns need SET NULL so a user can be deleted
-- even if they created items in someone else's workspace.
-- interactions.user_id cascades fully — logs are per-user.
-- ============================================================

ALTER TABLE entity_templates
  DROP CONSTRAINT IF EXISTS entity_templates_created_by_fkey,
  ADD CONSTRAINT entity_templates_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE entities
  DROP CONSTRAINT IF EXISTS entities_created_by_fkey,
  ADD CONSTRAINT entities_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_created_by_fkey,
  ADD CONSTRAINT contacts_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_created_by_fkey,
  ADD CONSTRAINT documents_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_created_by_fkey,
  ADD CONSTRAINT sessions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_created_by_fkey,
  ADD CONSTRAINT items_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE item_links
  DROP CONSTRAINT IF EXISTS item_links_created_by_fkey,
  ADD CONSTRAINT item_links_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE automations
  DROP CONSTRAINT IF EXISTS automations_created_by_fkey,
  ADD CONSTRAINT automations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE agents
  DROP CONSTRAINT IF EXISTS agents_created_by_fkey,
  ADD CONSTRAINT agents_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Interaction logs are meaningless without the user — cascade delete them
ALTER TABLE interactions
  DROP CONSTRAINT IF EXISTS interactions_user_id_fkey,
  ADD CONSTRAINT interactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;