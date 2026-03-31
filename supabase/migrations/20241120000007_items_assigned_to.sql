-- Add assigned_to column (defaults to creator, set at insert time)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
