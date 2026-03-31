-- ============================================================
-- Embar Migration 010 — midnight carry-on cron job
-- Requires: pg_cron + pg_net extensions (enabled in Supabase dashboard)
--
-- Run the SELECT below manually in the SQL editor with your actual values.
-- The anon key is safe to use here (it's already public via NEXT_PUBLIC_).
-- ============================================================

-- Replace the two placeholder values before running:
--   <PROJECT_URL>  → your NEXT_PUBLIC_SUPABASE_URL  (e.g. https://abcdef.supabase.co)
--   <ANON_KEY>     → your NEXT_PUBLIC_SUPABASE_ANON_KEY

SELECT cron.schedule(
  'midnight-carry-on',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url     := '<PROJECT_URL>/functions/v1/midnight-carry-on',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer <ANON_KEY>'
                 ),
      body    := '{}'::jsonb
    );
  $$
);
