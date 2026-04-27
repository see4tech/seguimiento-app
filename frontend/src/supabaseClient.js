import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  console.error('Faltan variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: { persistSession: false }
})

// Sube un blob de audio a Supabase Storage y retorna el path
export async function uploadVoice(blob) {
  const ext = blob.type.includes('mp4') ? 'm4a' : 'webm'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage
    .from('voice-updates')
    .upload(filename, blob, { contentType: blob.type || 'audio/webm', upsert: false })
  if (error) throw new Error('Error subiendo audio: ' + error.message)
  return data.path
}

// Retorna la URL pública de un archivo en Supabase Storage
export function getVoiceUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from('voice-updates').getPublicUrl(path)
  return data.publicUrl
}
