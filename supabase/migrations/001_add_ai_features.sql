-- Migración 001: Agregar transcripción y tabla de ingesta de reuniones
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- Agregar columna de transcripción a actualizaciones de gerentes
ALTER TABLE task_updates
  ADD COLUMN IF NOT EXISTS transcription TEXT;

-- Tabla para ingesta de reuniones
CREATE TABLE IF NOT EXISTS meeting_ingests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  storage_path     TEXT,           -- path en Supabase Storage bucket 'meeting-audio'
  original_filename TEXT,
  transcription    TEXT,
  extracted_tasks  JSONB,          -- array de tareas propuestas por la IA
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK(status IN ('pending','transcribing','extracting','review','done','error')),
  error_message    TEXT,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_ingests_user ON meeting_ingests(created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_ingests_status ON meeting_ingests(status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS meeting_ingests_updated_at ON meeting_ingests;
CREATE TRIGGER meeting_ingests_updated_at
  BEFORE UPDATE ON meeting_ingests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
