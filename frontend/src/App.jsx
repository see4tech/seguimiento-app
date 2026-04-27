import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ManagerPortal from './pages/ManagerPortal'
import TaskDetail from './pages/TaskDetail'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>

  return (
    <Routes>
      {user.role === 'admin' ? (
        <>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tareas/:id" element={<TaskDetail />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      ) : (
        <>
          <Route path="/" element={<ManagerPortal />} />
          <Route path="/tareas/:id" element={<TaskDetail />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
