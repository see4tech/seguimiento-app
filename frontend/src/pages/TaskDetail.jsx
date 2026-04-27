import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasks, updates } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { uploadVoice, getVoiceUrl } from '../supabaseClient'
import { StatusBadge, PriorityBadge } from '../components/StatusBadge'
import VoiceRecorder from '../components/VoiceRecorder'

const STATUS_OPTIONS = ['pending', 'in_progress', 'blocked', 'completed']
const STATUS_LABELS = { pending: 'Pendiente', in_progress: 'En curso', blocked: 'Bloqueado', completed: 'Completado' }

function formatDateTime(d) {
  return new Date(d).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [updateText, setUpdateText] = useState('')
  const [voiceBlob, setVoiceBlob] = useState(null)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    try {
      const data = await tasks.get(id)
      setTask(data)
      setEditForm({
        title: data.title,
        description: data.description || '',
        status: data.status,
        priority: data.priority,
        due_date: data.due_date ? data.due_date.split('T')[0] : '',
        source_notes: data.source_notes || '',
      })
    } finally {
      setLoading(false)
    }
  }

  async function saveEdit() {
    await tasks.update(id, editForm)
    setEditing(false)
    await load()
  }

  async function submitUpdate() {
    if (!updateText.trim() && !voiceBlob) return
    setSubmitting(true)
    try {
      let voice_storage_path = null
      if (voiceBlob) {
        voice_storage_path = await uploadVoice(voiceBlob)
      }
      await updates.add(id, {
        text_content: updateText.trim() || undefined,
        voice_storage_path,
        voice_duration: voiceDuration || undefined,
      })
      setUpdateText('')
      setVoiceBlob(null)
      setVoiceDuration(0)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteTask() {
    if (!confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) return
    await tasks.delete(id)
    navigate('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
  if (!task) return <div className="p-8 text-center text-gray-500">Tarea no encontrada</div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="font-semibold text-gray-900 flex-1 truncate">{task.title}</h1>
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} />
            {user.role === 'admin' && (
              <>
                <button onClick={() => setEditing(!editing)} className="btn-secondary text-sm py-1 px-3">
                  {editing ? 'Cancelar' : 'Editar'}
                </button>
                <button onClick={deleteTask} className="text-sm text-red-500 hover:text-red-700 px-2">🗑</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Task info */}
          {editing && user.role === 'admin' ? (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">Editar tarea</h2>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
                <input className="input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea className="input resize-none" rows={3} value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
                  <select className="input" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha límite</label>
                <input type="date" className="input" value={editForm.due_date}
                  onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas de contexto</label>
                <textarea className="input resize-none" rows={2} value={editForm.source_notes}
                  onChange={e => setEditForm(f => ({ ...f, source_notes: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={saveEdit} className="btn-primary flex-1">Guardar cambios</button>
              </div>
            </div>
          ) : (
            <div className="card p-5">
              <h2 className="text-lg font-semibold text-gray-900">{task.title}</h2>
              {task.description && <p className="text-gray-600 mt-2 leading-relaxed">{task.description}</p>}
              {task.source_notes && (
                <p className="text-sm text-gray-400 mt-3 italic border-l-2 border-gray-200 pl-3">{task.source_notes}</p>
              )}
            </div>
          )}

          {/* Updates timeline */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Historial de actualizaciones</h3>

            {task.updates?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin actualizaciones aún</p>
            ) : (
              <div className="space-y-4">
                {task.updates?.map(upd => (
                  <div key={upd.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {upd.user_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-900">{upd.user_name}</span>
                        <span className="text-xs text-gray-400">{formatDateTime(upd.created_at)}</span>
                      </div>
                      {upd.text_content && (
                        <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded-lg px-3 py-2">{upd.text_content}</p>
                      )}
                      {upd.voice_storage_path && (
                        <div className="mt-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <audio src={getVoiceUrl(upd.voice_storage_path)} controls className="h-7 max-w-full" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add update */}
            {task.status !== 'completed' && (
              <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agregar actualización</p>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={updateText}
                  onChange={e => setUpdateText(e.target.value)}
                  placeholder="Escribe el avance o novedad..."
                />
                <VoiceRecorder
                  onRecordingComplete={(blob, dur) => { setVoiceBlob(blob); setVoiceDuration(dur) }}
                  onClear={() => { setVoiceBlob(null); setVoiceDuration(0) }}
                />
                <button
                  onClick={submitUpdate}
                  disabled={submitting || (!updateText.trim() && !voiceBlob)}
                  className="btn-primary w-full"
                >
                  {submitting ? 'Enviando...' : 'Enviar actualización'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Detalles</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Estado</span>
                <StatusBadge status={task.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Prioridad</span>
                <PriorityBadge priority={task.priority} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Responsable</span>
                <span className="font-medium text-gray-900">{task.assigned_to_name}</span>
              </div>
              {task.due_date && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Vence</span>
                  <span className={`font-medium ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-600' : 'text-gray-900'}`}>
                    {new Date(task.due_date).toLocaleDateString('es', { day: 'numeric', month: 'long' })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Creada</span>
                <span className="text-gray-700">{new Date(task.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Origen</span>
                <span className="text-gray-700 capitalize">{task.source_type || 'manual'}</span>
              </div>
            </div>
          </div>

          {/* Quick status change for admin */}
          {user.role === 'admin' && (
            <div className="card p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Cambiar estado</h3>
              {STATUS_OPTIONS.map(s => (
                <button key={s} disabled={task.status === s}
                  onClick={async () => { await tasks.update(id, { status: s }); await load() }}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${task.status === s ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}>
                  {task.status === s && '● '}{STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
