-- Add voice note support to the messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_type    TEXT,        -- 'audio' for voice notes, NULL for text
  ADD COLUMN IF NOT EXISTS media_url     TEXT,        -- URL to the audio file (served by bot backend)
  ADD COLUMN IF NOT EXISTS transcription TEXT;        -- Whisper speech-to-text output

-- Persistent storage for voice note audio bytes.
-- Using the database avoids dependency on an external object store,
-- and Railway/Render ephemeral filesystems.
-- WhatsApp voice notes are typically OGG/Opus, 10 KB – 2 MB, so BYTEA is fine.
CREATE TABLE IF NOT EXISTS voice_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_data BYTEA       NOT NULL,
  mime_type  TEXT        NOT NULL DEFAULT 'audio/ogg',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
