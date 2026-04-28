const express = require('express')
const { getClient } = require('../db')
const { authMiddleware, adminOnly } = require('../middleware/auth')
const { transcribeAudio, extractTasks, downloadFromStorage } = require('../utils/ai')

const router = express.Router()

// POST /api/ingest
// Body: { storage_path, original_filename, title }
// Descarga el audio de Supabase Storage, transcribe con Groq, extrae tareas con OpenRouter
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { storage_path, original_filename, title } = req.body
  if (!storage_path) return res.status(400).json({ error: 'storage_path requerido' })

  const sb = getClient()

  // Crear registro inicial
  const { data: ingest, error: insertErr } = await sb
    .from('meeting_ingests')
    .insert({
      title: title || original_filename || 'Reunión',
      storage_path,
      original_filename: original_filename || null,
      status: 'transcribing',
      created_by: req.user.id,
    })
    .select()
    .single()

  if (insertErr) return res.status(500).json({ error: insertErr.message })

  try {
    // 1. Descargar audio de Supabase Storage
    const filename = original_filename || storage_path.split('/').pop()
    const audioBlob = await downloadFromStorage(sb, 'meeting-audio', storage_path)

    // 2. Transcribir con Groq Whisper
    const transcription = await transcribeAudio(audioBlob, filename)

    await sb.from('meeting_ingests')
      .update({ transcription, status: 'extracting' })
      .eq('id', ingest.id)

    // 3. Obtener nombres de gerentes para ayudar al modelo
    const { data: managers } = await sb
      .from('users')
      .select('id, name')
      .eq('role', 'manager')
      .eq('active', true)

    const managerNames = (managers || []).map(m => m.name)

    // 4. Extraer tareas con OpenRouter
    const aiResult = await extractTasks(transcription, managerNames)

    // Intentar asignar IDs de gerentes a las tareas extraídas
    const tasksWithIds = (aiResult.tasks || []).map(task => {
      const matched = (managers || []).find(m =>
        m.name.toLowerCase().includes((task.assigned_to_name || '').toLowerCase()) ||
        (task.assigned_to_name || '').toLowerCase().includes(m.name.toLowerCase())
      )
      return {
        ...task,
        assigned_to_id: matched?.id || null,
      }
    })

    const extracted_tasks = { tasks: tasksWithIds, summary: aiResult.summary }

    await sb.from('meeting_ingests')
      .update({ extracted_tasks, status: 'review' })
      .eq('id', ingest.id)

    res.json({
      id: ingest.id,
      status: 'review',
      transcription,
      summary: aiResult.summary,
      tasks: tasksWithIds,
    })

  } catch (err) {
    await sb.from('meeting_ingests')
      .update({ status: 'error', error_message: err.message })
      .eq('id', ingest.id)
    res.status(500).json({ error: err.message, ingest_id: ingest.id })
  }
})

// POST /api/ingest/:id/confirm
// Body: { tasks: [ { title, description, assigned_to, priority, due_date, source_notes } ] }
// Crea las tareas confirmadas por el admin
router.post('/:id/confirm', authMiddleware, adminOnly, async (req, res) => {
  const { tasks } = req.body
  if (!tasks?.length) return res.status(400).json({ error: 'No hay tareas para confirmar' })

  const sb = getClient()

  const { data: ingest } = await sb
    .from('meeting_ingests')
    .select('id, status')
    .eq('id', req.params.id)
    .single()

  if (!ingest) return res.status(404).json({ error: 'Ingesta no encontrada' })

  // Crear todas las tareas confirmadas
  const toInsert = tasks.map(t => ({
    title: t.title,
    description: t.description || null,
    assigned_to: t.assigned_to,
    created_by: req.user.id,
    priority: t.priority || 'normal',
    due_date: t.due_date || null,
    source_type: 'meeting',
    source_notes: t.source_notes || null,
  }))

  const { data: created, error } = await sb
    .from('tasks')
    .insert(toInsert)
    .select()

  if (error) return res.status(500).json({ error: error.message })

  await sb.from('meeting_ingests')
    .update({ status: 'done' })
    .eq('id', req.params.id)

  res.json({ created: created.length, tasks: created })
})

// GET /api/ingest — listar ingestas recientes (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  const sb = getClient()
  const { data } = await sb
    .from('meeting_ingests')
    .select('id, title, status, original_filename, created_at, error_message')
    .order('created_at', { ascending: false })
    .limit(20)
  res.json(data || [])
})

module.exports = router
