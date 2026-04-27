const BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de red' }))
    throw new Error(err.error || `Error ${res.status}`)
  }

  return res.json()
}

// Auth
export const auth = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  getUsers: () => request('/auth/users'),
  createUser: (data) => request('/auth/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/auth/users/${id}`, { method: 'PUT', body: data }),
  changePassword: (data) => request('/auth/me/password', { method: 'PUT', body: data }),
}

// Tasks
export const tasks = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/tasks${q ? '?' + q : ''}`)
  },
  summary: () => request('/tasks/summary'),
  get: (id) => request(`/tasks/${id}`),
  create: (data) => request('/tasks', { method: 'POST', body: data }),
  update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
}

// Updates
export const updates = {
  add: (taskId, formData) => request(`/updates/${taskId}`, {
    method: 'POST',
    body: formData, // FormData for voice + text
  }),
  weeklyReport: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/updates/weekly-report${q ? '?' + q : ''}`)
  },
}

export default { auth, tasks, updates }
