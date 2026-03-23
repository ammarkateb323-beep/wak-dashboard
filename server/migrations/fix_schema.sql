-- fix_schema.sql
-- Structural schema fix: run once in a single transaction.
-- Safe to run in dev/test — affected table data is wiped first.
-- Agents table data is PRESERVED.

BEGIN;

-- ── Step 1: Clear dependent data ─────────────────────────────────────────────
TRUNCATE TABLE
  survey_answers,
  survey_responses,
  messages,
  meetings,
  escalations
RESTART IDENTITY CASCADE;

-- ── Step 2: Fix escalations table ────────────────────────────────────────────

-- Drop the old primary key on customer_phone
ALTER TABLE escalations DROP CONSTRAINT escalations_pkey;

-- Drop the old FK that referenced escalations by customer_phone
-- (it was on escalations.assigned_agent_id → agents.id, no issue, but clean up)
-- The assigned_agent_id FK references agents.id — not customer_phone, so it survives.

-- Add proper auto-increment id as primary key
ALTER TABLE escalations ADD COLUMN id SERIAL PRIMARY KEY;

-- customer_phone is still required
ALTER TABLE escalations ALTER COLUMN customer_phone SET NOT NULL;

-- Index on customer_phone for fast lookups
CREATE INDEX IF NOT EXISTS idx_escalations_customer_phone
  ON escalations (customer_phone);

-- Index on assigned_agent_id
CREATE INDEX IF NOT EXISTS idx_escalations_assigned_agent
  ON escalations (assigned_agent_id);

-- ── Step 3: Fix meetings table ────────────────────────────────────────────────

-- Remove the plain text agent column
ALTER TABLE meetings DROP COLUMN IF EXISTS agent;

-- Add proper FK to agents
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES agents(id);

-- Index on agent_id
CREATE INDEX IF NOT EXISTS idx_meetings_agent_id
  ON meetings (agent_id);

-- ── Step 4: Fix survey_responses table ────────────────────────────────────────

-- Remove the redundant plain text agent column
ALTER TABLE survey_responses DROP COLUMN IF EXISTS agent;

-- Remove the redundant escalation_phone column
ALTER TABLE survey_responses DROP COLUMN IF EXISTS escalation_phone;

-- Add proper FK constraint on escalation_id now that escalations.id is a real PK
ALTER TABLE survey_responses
  ADD CONSTRAINT survey_responses_escalation_id_fkey
  FOREIGN KEY (escalation_id) REFERENCES escalations(id);

-- Add proper FK constraint on agent_id
ALTER TABLE survey_responses
  ADD CONSTRAINT survey_responses_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id);

-- ── Step 5: Fix messages table ────────────────────────────────────────────────

-- Add escalation_id FK so messages are linked to a chat session
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS escalation_id INTEGER REFERENCES escalations(id);

-- Index on escalation_id
CREATE INDEX IF NOT EXISTS idx_messages_escalation_id
  ON messages (escalation_id);

-- ── Step 6: Add missing performance indexes ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_customer_phone
  ON messages (customer_phone);

CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at
  ON meetings (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_survey_responses_agent_id
  ON survey_responses (agent_id);

COMMIT;
