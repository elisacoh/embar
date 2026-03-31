-- Enable Realtime for items table so the detail panel and entity view
-- receive live INSERT/UPDATE/DELETE events via Supabase channels.
-- items is already a member of supabase_realtime (added via dashboard).
-- This migration is a no-op kept for documentation.
do $$ begin end $$;
