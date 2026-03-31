-- ============================================================
-- Embar Migration 004 — workspace default + personal flag
-- ============================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT FALSE;

-- For existing users with a single workspace, mark it as personal + default
UPDATE workspaces w
SET
  is_personal = TRUE,
  is_default  = TRUE
WHERE (
  SELECT COUNT(*)
  FROM workspaces w2
  WHERE w2.owner_id = w.owner_id
    AND w2.deleted_at IS NULL
) = 1;

-- Update the new-user trigger to set flags on auto-created workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  INSERT INTO public.workspaces (id, name, type, owner_id, is_personal, is_default)
  VALUES (gen_random_uuid(), 'My Workspace', 'personal', new.id, TRUE, TRUE)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, new.id, 'owner');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;