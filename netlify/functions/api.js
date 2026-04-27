const express = require('express')
const cors = require('cors')
const serverless = require('serverless-http')

const app = express()

app.use(cors({ origin: '*', credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// Routes — prefixed /api/* (Netlify redirect passes full path)
app.use('/api/auth',    require('./routes/auth'))
app.use('/api/tasks',   require('./routes/tasks'))
app.use('/api/updates', require('./routes/updates'))

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// Catch-all 404
app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }))

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Error interno' })
})

module.exports.handler = serverless(app)
