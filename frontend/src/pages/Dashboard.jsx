import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { tasks, updates } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { getVoiceUrl } from '../supabaseClient'
import { StatusBadge, PriorityBadge, WeeksActiveBadge } from '../components/StatusBadge'
import NewTaskModal from '../components/NewTaskModal'
import UserManagement from '../components/UserManagement'

const STATUS_COLS = [
  { key: 'pending',     label: 'Pendiente',  color: 'bg-yellow-500' },
  { key: 'in_progress', label: 'En curso',   color: 'bg-blue-500' },
  { key: 'blocked',     label: 'Bloqueado',  color: 'bg-red-500' },
  { key: 'completed',   label: 'Completado', color: 'bg-green-500' },
]

function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function timeSince(d) {
  if (!d) return null
  const diff = Date.now() - new Date(d)
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return `hace ${Math.floor(days / 7)} sem`
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [allTasks, setAllTasks] = useState([])
  const [summary, setSummary] = useState(null)
  const [weeklyReport, setWeeklyReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('board') // board | weekly | list
  const [filterManager, setFilterManager] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showNewTask, setShowNewTask] = useState(false)
  const [showUsers, setShowUsers] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [managers, setManagers] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [taskList, sum] = await Promise.all([tasks.list(), tasks.summary()])
      setAllTasks(taskList)
      setSummary(sum)
      // Extract unique managers from tasks
      const mgrs = {}
      taskList.forEach(t => {
        if (!mgrs[t.assigned_to]) mgrs[t.assigned_to] = { id: t.assigned_to, name: t.assigned_to_name }
      })
      setManagers(Object.values(mgrs).sort((a, b) => a.name.localeCompare(b.name)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (view === 'weekly') {
      updates.weeklyReport().then(setWeeklyReport)
    }
  }, [view])

  // Filtered tasks
  const filtered = allTasks.filter(t => {
    if (filterManager !== 'all' && t.assigned_to !== filterManager) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    return true
  })

  // Group by status for board
  const byStatus = STATUS_COLS.reduce((acc, col) => {
    acc[col.key] = filtered.filter(t => t.status === col.key)
    return acc
  }, {})

  // Group by manager for list view
  const byManager = {}
  filtered.forEach(t => {
    if (!byManager[t.assigned_to]) byManager[t.assigned_to] = { name: t.assigned_to_name, tasks: [] }
    byManager[t.assigned_to].tasks.push(t)
  })

  const activeTasks = allTasks.filter(t => t.status !== 'completed').length
  const overdueTasks = allTasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <span className="font-bold text-gray-900">Seguimiento</span>
          </div>

          <div className="flex items-center gap-1 ml-4">
            {['board', 'list', 'weekly'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${view === v ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                {v === 'board' ? '📊 Tablero' : v === 'list' ? '📋 Por gerente' : '📅 Semanal'}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Stats pills */}
          <div className="hidden sm:flex items-center gap-3 text-sm">
            <span className="text-gray-500">{activeTasks} activas</span>
            {overdueTasks > 0 && (
              <span className="text-red-600 font-medium">⚠ {overdueTasks} vencidas</span>
            )}
          </div>

          <button onClick={() => navigate('/ingest')}
            className="flex items-center gap-1.5 text-sm py-1.5 px-3 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 font-medium transition-colors">
            🎙️ Procesar reunión
          </button>

          <button onClick={() => setShowNewTask(true)} className="btn-primary flex items-center gap-1.5 text-sm py-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva tarea
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center hover:bg-blue-200 transition-colors">
              {user.name.charAt(0).toUpperCase()}
            </button>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48 z-20">
                  <div className="px-3 py-2 border-b">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button onClick={() => { setShowUsers(true); setShowUserMenu(false) }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    👥 Gestionar usuarios
                  </button>
                  <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterManager} onChange={e => setFilterManager(e.target.value)}>
          <option value="all">Todos los gerentes</option>
          {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="in_progress">En curso</option>
          <option value="blocked">Bloqueados</option>
          <option value="completed">Completados</option>
        </select>
        <span className="text-sm text-gray-400">{filtered.length} tareas</span>
        <button onClick={load} className="ml-auto text-xs text-gray-400 hover:text-gray-600">↻ Actualizar</button>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (

          /* ─── BOARD VIEW ─── */
          view === 'board' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {STATUS_COLS.map(col => (
                <div key={col.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className={`h-1 ${col.color}`} />
                  <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                      {byStatus[col.key]?.length || 0}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[100px]">
                    {byStatus[col.key]?.map(task => (
                      <TaskCard key={task.id} task={task} onClick={() => navigate(`/tareas/${task.id}`)} />
                    ))}
                    {byStatus[col.key]?.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">Sin tareas</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

          /* ─── LIST VIEW (by manager) ─── */
          ) : view === 'list' ? (
            <div className="space-y-6">
              {Object.entries(byManager).map(([mid, { name, tasks: mtasks }]) => (
                <div key={mid} className="card overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="font-semibold text-gray-900">{name}</h3>
                    <span className="text-xs text-gray-400">{mtasks.length} tareas</span>
                    <button onClick={() => { setShowNewTask(true) }} className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-medium">+ Nueva</button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {mtasks.map(task => (
                      <div key={task.id} onClick={() => navigate(`/tareas/${task.id}`)}
                        className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          {task.description && <p className="text-xs text-gray-500 truncate mt-0.5">{task.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <WeeksActiveBadge createdAt={task.created_at} />
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                          {task.due_date && (
                            <span className={`text-xs ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                              {formatDate(task.due_date)}
                            </span>
                          )}
                          {task.last_update_at && (
                            <span className="text-xs text-gray-400">↑ {timeSince(task.last_update_at)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(byManager).length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="font-medium">Sin tareas aún</p>
                  <p className="text-sm mt-1">Crea la primera tarea para empezar</p>
                </div>
              )}
            </div>

          /* ─── WEEKLY VIEW ─── */
          ) : (
            <WeeklyView report={weeklyReport} navigate={navigate} />
          )
        )}
      </main>

      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreated={(task) => { setAllTasks(ts => [task, ...ts]); load() }}
        />
      )}
      {showUsers && <UserManagement onClose={() => { setShowUsers(false); load() }} />}
    </div>
  )
}

function TaskCard({ task, onClick }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'
  return (
    <div onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all group ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-100 hover:border-gray-200'}`}>
      <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
        {task.title}
      </p>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{task.assigned_to_name}</span>
        <PriorityBadge priority={task.priority} />
        <WeeksActiveBadge createdAt={task.created_at} />
      </div>
      {task.due_date && (
        <p className={`text-xs mt-1.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
          📅 {new Date(task.due_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
        </p>
      )}
      {task.update_count > 0 && (
        <p className="text-xs text-gray-400 mt-1">💬 {task.update_count} actualización{task.update_count !== 1 ? 'es' : ''}</p>
      )}
    </div>
  )
}

function WeeklyView({ report, navigate }) {
  if (!report) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Semana {report.week} — {report.year}
        </h2>
        <span className="text-sm text-gray-500">Actualizaciones recibidas esta semana</span>
      </div>

      {report.managers.map(mgr => (
        <div key={mgr.manager_id} className="card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center">
              {mgr.manager_name.charAt(0).toUpperCase()}
            </div>
            <h3 className="font-semibold text-gray-900">{mgr.manager_name}</h3>
            <span className={`ml-auto badge ${mgr.tasks.some(t => t.updates.length > 0) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {mgr.tasks.filter(t => t.updates.length > 0).length}/{mgr.tasks.length} reportaron
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {mgr.tasks.map(task => (
              <div key={task.task_id} className="px-5 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/tareas/${task.task_id}`)}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 flex-1">{task.task_title}</p>
                  <StatusBadge status={task.status} />
                  {task.updates.length === 0 && <span className="badge bg-yellow-50 text-yellow-700">Sin actualización</span>}
                </div>
                {task.updates.map(upd => (
                  <div key={upd.id} className="mt-2 pl-3 border-l-2 border-blue-200">
                    {upd.text_content && <p className="text-sm text-gray-700">{upd.text_content}</p>}
                    {upd.voice_storage_path && (
                      <div className="flex items-center gap-2 mt-1">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <audio src={getVoiceUrl(upd.voice_storage_path)} controls className="h-7" />
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{new Date(upd.created_at).toLocaleString('es')}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
