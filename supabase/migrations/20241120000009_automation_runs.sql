-- ============================================================
-- Embar Migration 009 — automation_runs log table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  automation    text        NOT NULL,                          -- e.g. 'midnight-carry-on'
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text        NOT NULL DEFAULT 'running'        -- running | success | error
                CHECK (status IN ('running', 'success', 'error')),
  affected_rows integer,
  error_message text,
  metadata      jsonb       DEFAULT '{}'
);

-- Only service-role can write; no user reads needed
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
-- No RLS policies — accessible only via service role key
