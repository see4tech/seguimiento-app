const express = require('express')
const { getClient } = require('../db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

const router = express.Router()

function getCurrentISOWeek() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return {
    week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7),
    year: d.getFullYear()
  }
}

// POST /api/updates/:taskId
// Body: { text_content?, voice_storage_path?, voice_duration? }
// Voice files are uploaded directly to Supabase Storage from the browser
router.post('/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params
    const { text_content, voice_storage_path, voice_duration } = req.body

    if (!text_content && !voice_storage_path) {
      return res.status(400).json({ error: 'Se requiere texto o audio' })
    }

    const sb = getClient()
    const { data: task, error: taskError } = await sb
      .from('tasks')
      .select('id, assigned_to, status')
      .eq('id', taskId)
      .single()

    if (taskError || !task) return res.status(404).json({ error: 'Tarea no encontrada' })

    if (req.user.role === 'manager' && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Solo puedes actualizar tus propias tareas' })
    }

    const { week, year } = getCurrentISOWeek()

    const { data: update, error } = await sb
      .from('task_updates')
      .insert({
        task_id: taskId,
        user_id: req.user.id,
        text_content: text_content || null,
        voice_storage_path: voice_storage_path || null,
        voice_duration: voice_duration ? parseInt(voice_duration) : null,
        update_week: week,
        update_year: year,
      })
      .select('*, user:users(name)')
      .single()

    if (error) throw error

    // Auto-progress status from pending → in_progress
    if (task.status === 'pending') {
      await sb.from('tasks').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', taskId)
    } else {
      await sb.from('tasks').update({ updated_at: new Date().toISOString() }).eq('id', taskId)
    }

    res.status(201).json({ ...update, user_name: update.user?.name, user: undefined })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/updates/weekly-report (admin)
router.get('/weekly-report', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { week: qw, year: qy } = req.query
    const { week, year } = qw ? { week: parseInt(qw), year: parseInt(qy) } : getCurrentISOWeek()

    const sb = getClient()

    const { data: managers } = await sb
      .from('users')
      .select('id, name')
      .eq('role', 'manager')
      .eq('active', true)
      .order('name')

    const { data: tasks } = await sb
      .from('tasks')
      .select('id, title, status, assigned_to')

    const { data: updates } = await sb
      .from('task_updates')
      .select('*')
      .eq('update_week', week)
      .eq('update_year', year)
      .order('created_at', { ascending: false })

    const updatesByTask = {}
    ;(updates || []).forEach(u => {
      if (!updatesByTask[u.task_id]) updatesByTask[u.task_id] = []
      updatesByTask[u.task_id].push(u)
    })

    const result = (managers || []).map(mgr => ({
      manager_id: mgr.id,
      manager_name: mgr.name,
      tasks: (tasks || [])
        .filter(t => t.assigned_to === mgr.id)
        .map(t => ({
          task_id: t.id,
          task_title: t.title,
          status: t.status,
          updates: updatesByTask[t.id] || [],
        }))
    }))

    res.json({ week, year, managers: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
