const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'seguimiento-dev-secret-change-in-production'

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) return res.status(401).json({ error: 'Token requerido' })

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado' })
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' })
  }
  next()
}

module.exports = { authMiddleware, adminOnly, JWT_SECRET }
