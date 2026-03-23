-- Survey system migration
-- Adapted for this codebase:
--   - escalation_phone TEXT (no int id on escalations table; PK is customer_phone)
--   - agent TEXT (no integer agent IDs; matches meetings.agent pattern)

CREATE TABLE IF NOT EXISTS surveys (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id            SERIAL PRIMARY KEY,
  survey_id     INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('rating','multiple_choice','free_text')),
  options       JSONB,
  order_index   INTEGER NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id               SERIAL PRIMARY KEY,
  survey_id        INTEGER REFERENCES surveys(id),
  token            TEXT UNIQUE NOT NULL,
  customer_phone   TEXT NOT NULL,
  agent            TEXT,
  escalation_phone TEXT,
  submitted        BOOLEAN DEFAULT false,
  submitted_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_answers (
  id            SERIAL PRIMARY KEY,
  response_id   INTEGER REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id   INTEGER REFERENCES survey_questions(id),
  answer_text   TEXT,
  answer_rating INTEGER CHECK (answer_rating IS NULL OR (answer_rating BETWEEN 1 AND 5)),
  answer_choice TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce only one active survey at a time
CREATE UNIQUE INDEX IF NOT EXISTS one_active_survey ON surveys (is_active) WHERE is_active = true;
