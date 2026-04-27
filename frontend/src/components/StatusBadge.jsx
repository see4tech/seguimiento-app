const STATUS = {
  pending:     { label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'En curso',     color: 'bg-blue-100 text-blue-800' },
  completed:   { label: 'Completado',   color: 'bg-green-100 text-green-800' },
  blocked:     { label: 'Bloqueado',    color: 'bg-red-100 text-red-800' },
}

const PRIORITY = {
  low:    { label: 'Baja',    color: 'bg-gray-100 text-gray-600' },
  normal: { label: 'Normal',  color: 'bg-blue-50 text-blue-600' },
  high:   { label: 'Alta',    color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pending
  return <span className={`badge ${s.color}`}>{s.label}</span>
}

export function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] || PRIORITY.normal
  return <span className={`badge ${p.color}`}>{p.label}</span>
}

export function WeeksActiveBadge({ createdAt }) {
  const weeks = Math.floor((Date.now() - new Date(createdAt)) / (7 * 24 * 60 * 60 * 1000))
  if (weeks === 0) return null
  const color = weeks >= 4 ? 'bg-red-100 text-red-700' : weeks >= 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
  return <span className={`badge ${color}`}>{weeks}s activa</span>
}
