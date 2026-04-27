/**
 * Crea el usuario administrador inicial en Supabase.
 * Correr una sola vez desde la raíz del proyecto:
 *   node scripts/setup.js
 * Requiere .env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 */
require('dotenv').config()
const bcrypt = require('bcryptjs')
const readline = require('readline')
const { getClient } = require('./functions-db')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = q => new Promise(r => rl.question(q, r))

async function main() {
  console.log('\n═══════════════════════════════════════')
  console.log('  Setup inicial — Sistema de Seguimiento')
  console.log('═══════════════════════════════════════\n')

  const sb = getClient()

  const { data: existing } = await sb.from('users').select('id').eq('role', 'admin').limit(1)
  if (existing?.length > 0) {
    const cont = await ask('⚠️  Ya existe un admin. ¿Crear otro? (s/N): ')
    if (cont.toLowerCase() !== 's') { console.log('Cancelado.\n'); rl.close(); return }
  }

  const name     = await ask('Nombre completo: ')
  const email    = await ask('Email: ')
  const password = await ask('Contraseña (mín. 6 caracteres): ')

  if (!name || !email || !password) { console.log('\n❌ Campos requeridos.\n'); rl.close(); return }
  if (password.length < 6) { console.log('\n❌ Contraseña muy corta.\n'); rl.close(); return }

  const hash = bcrypt.hashSync(password, 10)
  const { data, error } = await sb
    .from('users')
    .insert({ name: name.trim(), email: email.toLowerCase().trim(), password_hash: hash, role: 'admin' })
    .select('name, email')
    .single()

  if (error) { console.log('\n❌ Error:', error.message, '\n'); rl.close(); return }

  console.log(`\n✅ Admin creado: ${data.name} <${data.email}>\n`)
  rl.close()
}

main().catch(e => { console.error(e); process.exit(1) })
