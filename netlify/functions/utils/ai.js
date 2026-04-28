/**
 * Helpers de IA:
 * - transcribeAudio: Groq Whisper → texto
 * - extractTasks: OpenRouter → tareas estructuradas
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Transcribe un Blob de audio usando Groq Whisper.
 * @param {Blob} audioBlob
 * @param {string} filename
 * @returns {Promise<string>} transcripción en texto plano
 */
async function transcribeAudio(audioBlob, filename = 'audio.webm') {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada')

  const formData = new FormData()
  formData.append('file', audioBlob, filename)
  formData.append('model', 'whisper-large-v3')
  formData.append('language', 'es')
  formData.append('response_format', 'text')

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Groq error ${res.status}: ${errText}`)
  }

  const text = await res.text()
  return text.trim()
}

/**
 * Extrae tareas estructuradas de una transcripción usando OpenRouter.
 * @param {string} transcription
 * @param {string[]} managerNames lista de nombres de gerentes para ayudar al modelo a asignar
 * @returns {Promise<Array>} array de tareas propuestas
 */
async function extractTasks(transcription, managerNames = []) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada')

  const managersHint = managerNames.length > 0
    ? `Los gerentes del equipo son: ${managerNames.join(', ')}.`
    : ''

  const systemPrompt = `Eres un asistente experto en extraer compromisos y tareas de reuniones de trabajo.
${managersHint}

Analiza la transcripción y extrae TODAS las tareas, compromisos y acuerdos mencionados.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "tasks": [
    {
      "title": "Título conciso de la tarea (max 80 caracteres)",
      "description": "Descripción detallada con contexto y objetivo",
      "assigned_to_name": "Nombre del responsable mencionado o null",
      "due_date": "YYYY-MM-DD o null",
      "priority": "low|normal|high|urgent",
      "source_notes": "Contexto exacto de la reunión donde surgió este compromiso"
    }
  ],
  "summary": "Resumen ejecutivo de la reunión en 2-3 oraciones"
}

Si no encuentras responsable claro para una tarea, usa null en assigned_to_name.
Prioridad "urgent" solo si se mencionó explícitamente urgencia o fecha muy próxima.`

  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://recordari.netlify.app',
      'X-Title': 'Seguimiento App',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transcripción de la reunión:\n\n${transcription}` },
      ],
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ''

  // Extraer JSON de la respuesta (puede venir con markdown)
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('La IA no devolvió JSON válido')

  const parsed = JSON.parse(jsonMatch[0])
  return parsed
}

/**
 * Descarga un archivo de Supabase Storage y lo devuelve como Blob.
 * @param {object} supabase cliente de Supabase
 * @param {string} bucket nombre del bucket
 * @param {string} path path del archivo
 */
async function downloadFromStorage(supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw new Error(`Error descargando de Storage: ${error.message}`)
  return data // Blob
}

module.exports = { transcribeAudio, extractTasks, downloadFromStorage }
