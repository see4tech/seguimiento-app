-- ============================================================
-- Schema para Sistema de Seguimiento
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Tabla de usuarios (admin + gerentes)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('admin', 'manager')),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de tareas
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  assigned_to  UUID NOT NULL REFERENCES users(id),
  created_by   UUID NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending', 'in_progress', 'completed', 'blocked')),
  priority     TEXT NOT NULL DEFAULT 'normal'
                 CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
  due_date     DATE,
  week_number  INTEGER,
  week_year    INTEGER,
  source_type  TEXT CHECK(source_type IN ('manual', 'meeting', 'email', 'note', 'audio')),
  source_notes TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de actualizaciones semanales
CREATE TABLE IF NOT EXISTS task_updates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id),
  text_content        TEXT,
  voice_storage_path  TEXT,      -- path en Supabase Storage bucket 'voice-updates'
  voice_duration      INTEGER,   -- segundos
  update_week         INTEGER,
  update_year         INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_week     ON tasks(week_year, week_number);
CREATE INDEX IF NOT EXISTS idx_updates_task   ON task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_updates_week   ON task_updates(update_year, update_week);

-- Trigger para updated_at automático en tasks
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security (RLS) — desactivado porque usamos
-- service_role_key en las funciones serverless (acceso total).
-- Si quisieras activarlo en el futuro, aquí van las políticas.
-- ============================================================
-- ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Storage bucket 'voice-updates'
-- Crear manualmente en: Supabase → Storage → New bucket
--   Nombre:  voice-updates
--   Public:  true (para reproducir audio sin autenticación)
-- ============================================================
