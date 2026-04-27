import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tasks, updates } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { uploadVoice } from '../supabaseClient'
import { StatusBadge, PriorityBadge, WeeksActiveBadge } from '../components/StatusBadge'
import VoiceRecorder from '../components/VoiceRecorder'

function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'long' })
}

export default function ManagerPortal() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [myTasks, setMyTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeUpdate, setActiveUpdate] = useState(null) // task id being updated
  const [updateText, setUpdateText] = useState('')
  const [voiceBlob, setVoiceBlob] = useState(null)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [filterStatus, setFilterStatus] = useState('active') // active | completed | all

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await tasks.list()
      setMyTasks(data)
    } finally {
      setLoading(false)
    }
  }

  const filtered = myTasks.filter(t => {
    if (filterStatus === 'active') return t.status !== 'completed'
    if (filterStatus === 'completed') return t.status === 'completed'
    return true
  })

  async function submitUpdate(taskId) {
    if (!updateText.trim() && !voiceBlob) return
    setSubmitting(true)
    try {
      let voice_storage_path = null
      if (voiceBlob) {
        voice_storage_path = await uploadVoice(voiceBlob)
      }
      await updates.add(taskId, {
        text_content: updateText.trim() || undefined,
        voice_storage_path,
        voice_duration: voiceDuration || undefined,
      })
      setUpdateText('')
      setVoiceBlob(null)
      setVoiceDuration(0)
      setActiveUpdate(null)
      setSuccessMsg('Actualización enviada ✓')
      setTimeout(() => setSuccessMsg(''), 3000)
      await load()
    } catch (err) {
      alert('Error al enviar: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const pendingUpdate = myTasks.filter(t => t.status !== 'completed').length
  const completedThisWeek = myTasks.filter(t => {
    if (t.status !== 'completed') return false
    const diff = Date.now() - new Date(t.updated_at)
    return diff < 7 * 24 * 60 * 60 * 1000
  }).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-xl">📋</span>
          <div className="flex-1">
            <span className="font-bold text-gray-900">Mis tareas</span>
            <span className="ml-2 text-sm text-gray-500">Hola, {user.name.split(' ')[0]}</span>
          </div>

          {successMsg && (
            <span className="text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">{successMsg}</span>
          )}

          <div className="relative group">
            <button className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center hover:bg-blue-200 transition-colors">
              {user.name.charAt(0).toUpperCase()}
            </button>
            <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44 hidden group-hover:block z-20">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              </div>
              <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{pendingUpdate}</p>
            <p className="text-xs text-gray-500 mt-0.5">Activas</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{myTasks.filter(t => t.status === 'blocked').length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Bloqueadas</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completedThisWeek}</p>
            <p className="text-xs text-gray-500 mt-0.5">Completadas (7d)</p>
          </div>
        </div>

        {/* Weekly reminder */}
        {new Date().getDay() === 5 && pendingUpdate > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="font-semibold text-amber-900">¡Es viernes!</p>
              <p className="text-sm text-amber-700 mt-0.5">Tienes {pendingUpdate} tareas activas. Recuerda reportar el avance semanal antes de terminar el día.</p>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2">
          {[['active', 'Activas'], ['completed', 'Completadas'], ['all', 'Todas']].map(([k, l]) => (
            <button key={k} onClick={() => setFilterStatus(k)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${filterStatus === k ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              {l}
            </button>
          ))}
          <button onClick={load} className="ml-auto text-xs text-gray-400 hover:text-gray-600">↻</button>
        </div>

        {/* Task list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-medium">Sin tareas {filterStatus === 'active' ? 'activas' : filterStatus === 'completed' ? 'completadas' : ''}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(task => (
              <div key={task.id} className="card overflow-hidden">
                {/* Task header */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 leading-snug">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">{task.description}</p>
                      )}
                      {task.source_notes && (
                        <p className="text-xs text-gray-400 mt-1 italic">Contexto: {task.source_notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    <WeeksActiveBadge createdAt={task.created_at} />
                    {task.due_date && (
                      <span className={`badge ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        📅 {formatDate(task.due_date)}
                      </span>
                    )}
                    {task.update_count > 0 && (
                      <span className="badge bg-gray-100 text-gray-500">💬 {task.update_count} actualiz.</span>
                    )}
                  </div>
                </div>

                {/* Action bar */}
                {task.status !== 'completed' && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/tareas/${task.id}`)}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Ver detalle →
                    </button>
                    <div className="flex-1" />
                    {activeUpdate === task.id ? (
                      <button onClick={() => { setActiveUpdate(null); setUpdateText(''); setVoiceBlob(null) }}
                        className="text-xs text-gray-500 hover:text-gray-700">
                        Cancelar
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveUpdate(task.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-white border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Reportar avance
                      </button>
                    )}
                  </div>
                )}

                {/* Update form */}
                {activeUpdate === task.id && (
                  <div className="border-t border-blue-100 bg-blue-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Actualización semanal</p>

                    <textarea
                      className="input bg-white resize-none"
                      rows={3}
                      value={updateText}
                      onChange={e => setUpdateText(e.target.value)}
                      placeholder="Escribe el avance, bloqueo o novedad de esta tarea..."
                      autoFocus
                    />

                    <VoiceRecorder
                      onRecordingComplete={(blob, dur) => { setVoiceBlob(blob); setVoiceDuration(dur) }}
                      onClear={() => { setVoiceBlob(null); setVoiceDuration(0) }}
                    />

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => submitUpdate(task.id)}
                        disabled={submitting || (!updateText.trim() && !voiceBlob)}
                        className="btn-primary text-sm py-2 flex-1"
                      >
                        {submitting ? 'Enviando...' : 'Enviar actualización'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
