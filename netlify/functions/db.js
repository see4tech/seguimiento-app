const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
}

// Singleton — reutilizar el cliente entre invocaciones en el mismo contenedor
let _client = null
function getClient() {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })
  }
  return _client
}

module.exports = { getClient }
