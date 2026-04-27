const express = require('express')
const { getClient } = require('../db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

const router = express.Router()

function getISOWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return {
    week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7),
    year: d.getFullYear()
  }
}

// Flatten Supabase joined task row to flat object
function flattenTask(t) {
  return {
    ...t,
    assigned_to: t.assigned_user?.id || t.assigned_to,
    assigned_to_name: t.assigned_user?.name,
    assigned_to_email: t.assigned_user?.email,
    created_by_name: t.creator?.name,
    assigned_user: undefined,
    creator: undefined,
  }
}

// GET /api/tasks
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, manager_id } = req.query
    const sb = getClient()

    let query = sb
      .from('tasks')
      .select(`*, assigned_user:users!assigned_to(id,name,email), creator:users!created_by(id,name)`)
      .order('created_at', { ascending: false })

    if (req.user.role === 'manager') {
      query = query.eq('assigned_to', req.user.id)
    } else if (manager_id) {
      query = query.eq('assigned_to', manager_id)
    }

    if (status) query = query.eq('status', status)

    const { data: taskList, error } = await query
    if (error) throw error

    // Add update_count via separate query (efficient enough for this scale)
    const taskIds = taskList.map(t => t.id)
    let updateCounts = {}
    let lastUpdates = {}

    if (taskIds.length > 0) {
      const { data: counts } = await sb
        .from('task_updates')
        .select('task_id, created_at')
        .in('task_id', taskIds)
        .order('created_at', { ascending: false })

      if (counts) {
        counts.forEach(u => {
          updateCounts[u.task_id] = (updateCounts[u.task_id] || 0) + 1
          if (!lastUpdates[u.task_id]) lastUpdates[u.task_id] = u.created_at
        })
      }
    }

    const result = taskList.map(t => ({
      ...flattenTask(t),
      update_count: updateCounts[t.id] || 0,
      last_update_at: lastUpdates[t.id] || null,
    }))

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tasks/summary (admin)
router.get('/summary', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sb = getClient()

    const { data: managers } = await sb
      .from('users')
      .select('id, name')
      .eq('role', 'manager')
      .eq('active', true)
      .order('name')

    const { data: allTasks } = await sb.from('tasks').select('id, assigned_to, status, due_date')

    const managerStats = (managers || []).map(m => {
      const mTasks = (allTasks || []).filter(t => t.assigned_to === m.id)
      const now = new Date()
      return {
        ...m,
        total_tasks:  mTasks.length,
        pending:      mTasks.filter(t => t.status === 'pending').length,
        in_progress:  mTasks.filter(t => t.status === 'in_progress').length,
        completed:    mTasks.filter(t => t.status === 'completed').length,
        blocked:      mTasks.filter(t => t.status === 'blocked').length,
        overdue:      mTasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < now).length,
      }
    })

    const { data: recentUpdates } = await sb
      .from('task_updates')
      .select('*, user:users(name), task:tasks(title)')
      .order('created_at', { ascending: false })
      .limit(10)

    res.json({ managers: managerStats, recentUpdates: recentUpdates || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tasks/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const sb = getClient()
    const { data: task, error } = await sb
      .from('tasks')
      .select(`*, assigned_user:users!assigned_to(id,name,email), creator:users!created_by(id,name)`)
      .eq('id', req.params.id)
      .single()

    if (error || !task) return res.status(404).json({ error: 'Tarea no encontrada' })
    if (req.user.role === 'manager' && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado' })
    }

    const { data: updates } = await sb
      .from('task_updates')
      .select('*, user:users(name)')
      .eq('task_id', req.params.id)
      .order('created_at', { ascending: false })

    const flat = flattenTask(task)
    flat.updates = (updates || []).map(u => ({ ...u, user_name: u.user?.name, user: undefined }))

    res.json(flat)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tasks (admin)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, description, assigned_to, priority, due_date, source_type, source_notes } = req.body
    if (!title || !assigned_to) return res.status(400).json({ error: 'Título y responsable requeridos' })

    const sb = getClient()
    const { data: mgr } = await sb.from('users').select('id').eq('id', assigned_to).eq('role', 'manager').single()
    if (!mgr) return res.status(400).json({ error: 'Gerente no válido' })

    let week_number = null, week_year = null
    if (due_date) {
      const wk = getISOWeek(due_date)
      week_number = wk.week
      week_year = wk.year
    }

    const { data: task, error } = await sb
      .from('tasks')
      .insert({
        title: title.trim(),
        description: description || null,
        assigned_to,
        created_by: req.user.id,
        priority: priority || 'normal',
        due_date: due_date || null,
        week_number,
        week_year,
        source_type: source_type || 'manual',
        source_notes: source_notes || null,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(task)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/tasks/:id (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, description, assigned_to, status, priority, due_date, source_notes } = req.body
    const sb = getClient()

    const updates = { updated_at: new Date().toISOString() }
    if (title !== undefined)       updates.title = title.trim()
    if (description !== undefined) updates.description = description || null
    if (assigned_to !== undefined) updates.assigned_to = assigned_to
    if (status !== undefined)      updates.status = status
    if (priority !== undefined)    updates.priority = priority
    if (source_notes !== undefined) updates.source_notes = source_notes || null
    if (due_date !== undefined) {
      updates.due_date = due_date || null
      if (due_date) {
        const wk = getISOWeek(due_date)
        updates.week_number = wk.week
        updates.week_year = wk.year
      } else {
        updates.week_number = null
        updates.week_year = null
      }
    }

    const { data: task, error } = await sb
      .from('tasks')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(task)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/tasks/:id (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sb = getClient()
    const { error } = await sb.from('tasks').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
