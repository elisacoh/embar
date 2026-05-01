-- Track cumulative time spent on an item across focus sessions
ALTER TABLE items ADD COLUMN IF NOT EXISTS time_spent_ms INTEGER NOT NULL DEFAULT 0;
