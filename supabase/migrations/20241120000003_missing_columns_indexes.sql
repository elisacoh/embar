-- ============================================================
-- Embar Migration 003 — missing columns, indexes, constraints
-- Safe to run: all changes use IF NOT EXISTS guards
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. items — add assigned_to (collaboration) and updated_at
-- ────────────────────────────────────────────────────────────

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE items
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_updated_at ON items;
CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- 2. agents — add updated_at and deleted_at
-- ────────────────────────────────────────────────────────────

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

UPDATE agents
SET updated_at = created_at
WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS agents_updated_at ON agents;
CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- 3. automations — add last_error
-- ────────────────────────────────────────────────────────────

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS last_error TEXT;


-- ────────────────────────────────────────────────────────────
-- 4. entities — add type (AI-inferred, never shown to user)
-- ────────────────────────────────────────────────────────────

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS type TEXT;


-- ────────────────────────────────────────────────────────────
-- 5. Missing indexes
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON workspace_members(user_id);

CREATE INDEX IF NOT EXISTS idx_items_assigned_to
  ON items(assigned_to)
  WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_items_due_date
  ON items(workspace_id, due_date)
  WHERE deleted_at IS NULL AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_items_waiting
  ON items(workspace_id, waiting_for, waiting_since)
  WHERE deleted_at IS NULL AND waiting_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entities_workspace
  ON entities(workspace_id, position)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_interactions_object
  ON interactions(object_type, object_id);


-- ────────────────────────────────────────────────────────────
-- 6. All workspaces view
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW my_items AS
SELECT
  i.*,
  e.name  AS entity_name,
  e.color AS entity_color,
  w.name  AS workspace_name,
  w.color AS workspace_color
FROM items i
LEFT JOIN entities e
  ON e.id = i.entity_id
JOIN workspaces w
  ON w.id = i.workspace_id
JOIN workspace_members wm
  ON wm.workspace_id = i.workspace_id
 AND wm.user_id = auth.uid()
WHERE i.deleted_at IS NULL
  AND w.deleted_at IS NULL
  AND (
    i.assigned_to = auth.uid()
    OR i.created_by = auth.uid()
  );

