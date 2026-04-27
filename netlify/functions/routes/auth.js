const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getClient } = require('../db')
const { authMiddleware, adminOnly, JWT_SECRET } = require('../middleware/auth')

const router = express.Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

    const sb = getClient()
    const { data: user, error } = await sb
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('active', true)
      .single()

    if (error || !user) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const valid = bcrypt.compareSync(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const sb = getClient()
    const { data: user } = await sb
      .from('users')
      .select('id, name, email, role')
      .eq('id', req.user.id)
      .single()

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/users (admin)
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sb = getClient()
    const { data: users } = await sb
      .from('users')
      .select('id, name, email, role, active, created_at')
      .order('role', { ascending: false })
      .order('name')

    res.json(users || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/users (admin)
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' })
    }
    if (!['admin', 'manager'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' })
    }

    const sb = getClient()
    const hash = bcrypt.hashSync(password, 10)

    const { data: newUser, error } = await sb
      .from('users')
      .insert({ name: name.trim(), email: email.toLowerCase().trim(), password_hash: hash, role })
      .select('id, name, email, role')
      .single()

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' })
      throw error
    }

    res.status(201).json(newUser)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/auth/users/:id (admin)
router.put('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, active, password } = req.body
    const sb = getClient()
    const updates = {}

    if (name !== undefined) updates.name = name.trim()
    if (active !== undefined) updates.active = Boolean(active)
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' })
      updates.password_hash = bcrypt.hashSync(password, 10)
    }

    await sb.from('users').update(updates).eq('id', req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/auth/me/password
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Ambas contraseñas son requeridas' })
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Nueva contraseña mínimo 6 caracteres' })
    }

    const sb = getClient()
    const { data: user } = await sb.from('users').select('password_hash').eq('id', req.user.id).single()

    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    }

    await sb.from('users').update({ password_hash: bcrypt.hashSync(new_password, 10) }).eq('id', req.user.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
