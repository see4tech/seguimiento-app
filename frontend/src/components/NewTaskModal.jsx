import { useState, useEffect } from 'react'
import { tasks, auth } from '../api'

export default function NewTaskModal({ onClose, onCreated, preselectedManager }) {
  const [managers, setManagers] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: preselectedManager || '',
    priority: 'normal',
    due_date: '',
    source_type: 'manual',
    source_notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    auth.getUsers().then(users => setManagers(users.filter(u => u.role === 'manager' && u.active)))
  }, [])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.assigned_to) {
      setError('Título y responsable son requeridos')
      return
    }
    setLoading(true)
    setError('')
    try {
      const task = await tasks.create(form)
      onCreated(task)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Nueva tarea</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input className="input" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Qué debe hacer el gerente..." required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Contexto</label>
            <textarea className="input resize-none" rows={3} value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Detalles, antecedentes, objetivo..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable *</label>
              <select className="input" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} required>
                <option value="">Seleccionar...</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite</label>
              <input type="date" className="input" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
              <select className="input" value={form.source_type} onChange={e => set('source_type', e.target.value)}>
                <option value="manual">Manual</option>
                <option value="meeting">Reunión</option>
                <option value="email">Correo</option>
                <option value="note">Nota</option>
                <option value="audio">Audio</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas de contexto</label>
            <textarea className="input resize-none" rows={2} value={form.source_notes}
              onChange={e => set('source_notes', e.target.value)}
              placeholder="De dónde viene esta tarea, quién la pidió..." />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creando...' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
