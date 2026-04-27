import { useState, useEffect } from 'react'
import { auth } from '../api'

export default function UserManagement({ onClose }) {
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const data = await auth.getUsers()
    setUsers(data)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await auth.createUser(form)
      await load()
      setForm({ name: '', email: '', password: '', role: 'manager' })
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(user) {
    await auth.updateUser(user.id, { active: !user.active })
    await load()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Gestión de usuarios</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* User list */}
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className={`flex items-center gap-3 p-3 rounded-lg border ${u.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <span className={`badge ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {u.role === 'admin' ? 'Admin' : 'Gerente'}
                </span>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => toggleActive(u)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${u.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                  >
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add user form */}
          {showForm ? (
            <form onSubmit={handleCreate} className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50">
              <h3 className="text-sm font-semibold text-blue-800">Nuevo usuario</h3>
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Nombre completo" value={form.name} onChange={e => set('name', e.target.value)} required />
                <input className="input" type="email" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} required />
                <input className="input" type="password" placeholder="Contraseña" value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} />
                <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="manager">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {error && <p className="text-red-600 text-xs">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm py-1.5 px-3">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary text-sm py-1.5 px-3">
                  {loading ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar usuario
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
