import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../api'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const BUCKET = 'meeting-audio'

const STEPS = {
  UPLOAD:    'upload',
  PROCESSING:'processing',
  REVIEW:    'review',
  DONE:      'done',
}

function StatusBar({ step }) {
  const steps = [
    { key: STEPS.UPLOAD,     label: 'Subir audio' },
    { key: STEPS.PROCESSING, label: 'Transcribir + extraer' },
    { key: STEPS.REVIEW,     label: 'Revisar tareas' },
    { key: STEPS.DONE,       label: 'Listo' },
  ]
  const idx = steps.findIndex(s => s.key === step)
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            ${i < idx ? 'bg-green-500 text-white' : i === idx ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
            {i < idx ? '✓' : i + 1}
          </div>
          <span className={`text-sm ${i === idx ? 'font-medium text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
          {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

export default function IngestPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [step, setStep] = useState(STEPS.UPLOAD)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [processingMsg, setProcessingMsg] = useState('')
  const [error, setError] = useState('')

  // Resultado de la IA
  const [transcription, setTranscription] = useState('')
  const [summary, setSummary] = useState('')
  const [extractedTasks, setExtractedTasks] = useState([])
  const [ingestId, setIngestId] = useState(null)
  const [managers, setManagers] = useState([])
  const [showTranscription, setShowTranscription] = useState(false)

  // Estado de confirmación
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => { auth.getUsers().then(u => setManagers(u.filter(m => m.role === 'manager' && m.active))) }, [])

  async function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function handleProcess() {
    if (!file) return
    setError('')
    setUploading(true)
    setStep(STEPS.PROCESSING)
    setProcessingMsg('Subiendo audio a Supabase Storage…')

    try {
      // 1. Subir a Supabase Storage
      const ext = file.name.split('.').pop()
      const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type })
      if (uploadErr) throw new Error('Error subiendo archivo: ' + uploadErr.message)

      // 2. Llamar al API para transcribir + extraer
      setProcessingMsg('Transcribiendo con Groq Whisper… (puede tomar 10-30 segundos)')
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          storage_path: storagePath,
          original_filename: file.name,
          title: title || file.name,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error procesando el audio')
      }

      const data = await res.json()
      setIngestId(data.id)
      setTranscription(data.transcription || '')
      setSummary(data.summary || '')
      setExtractedTasks((data.tasks || []).map((t, i) => ({ ...t, _id: i, _include: true })))
      setStep(STEPS.REVIEW)

    } catch (err) {
      setError(err.message)
      setStep(STEPS.UPLOAD)
    } finally {
      setUploading(false)
      setProcessingMsg('')
    }
  }

  function updateTask(idx, field, value) {
    setExtractedTasks(ts => ts.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  async function handleConfirm() {
    const toCreate = extractedTasks.filter(t => t._include && t.assigned_to)
    if (!toCreate.length) {
      setError('Asigna al menos una tarea a un gerente antes de confirmar.')
      return
    }
    setConfirming(true)
    setError('')
    try {
      const res = await fetch(`/api/ingest/${ingestId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          tasks: toCreate.map(t => ({
            title: t.title,
            description: t.description,
            assigned_to: t.assigned_to,
            priority: t.priority,
            due_date: t.due_date,
            source_notes: t.source_notes,
          })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setConfirmed(true)
      setStep(STEPS.DONE)
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  const includedCount = extractedTasks.filter(t => t._include).length
  const assignedCount = extractedTasks.filter(t => t._include && t.assigned_to).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="font-semibold text-gray-900">Procesar reunión</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <StatusBar step={step} />

        {/* ── STEP 1: UPLOAD ── */}
        {step === STEPS.UPLOAD && (
          <div className="card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sube el audio de la reunión</h2>
              <p className="text-sm text-gray-500 mt-1">Se transcribirá con Groq Whisper y la IA extraerá las tareas y compromisos.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título de la reunión</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Reunión de seguimiento semanal — 27 abril" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Archivo de audio</label>
              <div
                onClick={() => fileRef.current.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                  ${file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
              >
                {file ? (
                  <div className="space-y-1">
                    <p className="text-2xl">🎙️</p>
                    <p className="font-medium text-green-700">{file.name}</p>
                    <p className="text-sm text-green-600">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    <p className="text-xs text-gray-500 mt-2">Click para cambiar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-3xl">📁</p>
                    <p className="text-gray-600 font-medium">Click para seleccionar archivo</p>
                    <p className="text-xs text-gray-400">MP3, MP4, M4A, WAV, WEBM — máx. 25MB (límite Groq Whisper)</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden"
                accept="audio/*,video/mp4,video/webm" onChange={handleFile} />
            </div>

            {file && file.size > 25 * 1024 * 1024 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                ⚠️ El archivo supera 25MB (límite de Groq Whisper). Comprime el audio o usa un fragmento más corto.
              </div>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={handleProcess}
              disabled={!file || uploading || file.size > 25 * 1024 * 1024}
              className="btn-primary w-full py-3 text-base"
            >
              Procesar reunión →
            </button>
          </div>
        )}

        {/* ── STEP 2: PROCESSING ── */}
        {step === STEPS.PROCESSING && (
          <div className="card p-10 text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="font-medium text-gray-900">{processingMsg || 'Procesando…'}</p>
            <p className="text-sm text-gray-500">Esto puede tomar entre 15 y 60 segundos según la duración del audio.</p>
          </div>
        )}

        {/* ── STEP 3: REVIEW ── */}
        {step === STEPS.REVIEW && (
          <div className="space-y-4">
            {/* Resumen */}
            {summary && (
              <div className="card p-4 bg-blue-50 border-blue-200">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Resumen de la reunión</p>
                <p className="text-sm text-blue-900">{summary}</p>
              </div>
            )}

            {/* Transcripción colapsable */}
            <div className="card overflow-hidden">
              <button
                onClick={() => setShowTranscription(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">📝 Ver transcripción completa</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showTranscription ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showTranscription && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mt-3 max-h-60 overflow-y-auto">
                    {transcription}
                  </p>
                </div>
              )}
            </div>

            {/* Tareas extraídas */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">
                  Tareas extraídas ({extractedTasks.length})
                </h2>
                <span className="text-xs text-gray-500">{assignedCount}/{includedCount} asignadas</span>
              </div>

              <div className="divide-y divide-gray-50">
                {extractedTasks.map((task, idx) => (
                  <div key={idx} className={`p-4 transition-colors ${!task._include ? 'opacity-40 bg-gray-50' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* Checkbox incluir/excluir */}
                      <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                        checked={task._include}
                        onChange={e => updateTask(idx, '_include', e.target.checked)} />

                      <div className="flex-1 space-y-3">
                        {/* Título */}
                        <input
                          className="input font-medium"
                          value={task.title}
                          onChange={e => updateTask(idx, 'title', e.target.value)}
                          placeholder="Título de la tarea"
                        />

                        {/* Descripción */}
                        <textarea
                          className="input resize-none text-sm"
                          rows={2}
                          value={task.description || ''}
                          onChange={e => updateTask(idx, 'description', e.target.value)}
                          placeholder="Descripción / contexto"
                        />

                        <div className="grid grid-cols-2 gap-3">
                          {/* Responsable */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Responsable
                              {task.assigned_to_name && !task.assigned_to &&
                                <span className="ml-1 text-orange-500">(IA sugirió: {task.assigned_to_name})</span>}
                            </label>
                            <select
                              className={`input text-sm ${!task.assigned_to ? 'border-orange-300' : ''}`}
                              value={task.assigned_to || ''}
                              onChange={e => updateTask(idx, 'assigned_to', e.target.value)}
                            >
                              <option value="">— Asignar gerente —</option>
                              {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </div>

                          {/* Prioridad */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Prioridad</label>
                            <select className="input text-sm" value={task.priority || 'normal'}
                              onChange={e => updateTask(idx, 'priority', e.target.value)}>
                              <option value="low">Baja</option>
                              <option value="normal">Normal</option>
                              <option value="high">Alta</option>
                              <option value="urgent">Urgente</option>
                            </select>
                          </div>
                        </div>

                        {/* Fecha límite */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Fecha límite</label>
                          <input type="date" className="input text-sm"
                            value={task.due_date || ''}
                            onChange={e => updateTask(idx, 'due_date', e.target.value)} />
                        </div>

                        {/* Contexto de la reunión */}
                        {task.source_notes && (
                          <p className="text-xs text-gray-400 italic border-l-2 border-gray-200 pl-2">
                            "{task.source_notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Aviso sin asignar */}
            {includedCount > assignedCount && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
                ⚠️ {includedCount - assignedCount} tarea(s) sin responsable asignado. No se crearán hasta que asignes un gerente.
              </div>
            )}

            {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep(STEPS.UPLOAD); setFile(null) }}
                className="btn-secondary">
                ← Volver
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || assignedCount === 0}
                className="btn-primary flex-1 py-3"
              >
                {confirming ? 'Creando tareas…' : `Crear ${assignedCount} tarea${assignedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: DONE ── */}
        {step === STEPS.DONE && (
          <div className="card p-10 text-center space-y-4">
            <p className="text-5xl">✅</p>
            <h2 className="text-xl font-semibold text-gray-900">¡Tareas creadas!</h2>
            <p className="text-gray-500">
              Se crearon {assignedCount} tarea{assignedCount !== 1 ? 's' : ''} a partir de la reunión.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button onClick={() => { setStep(STEPS.UPLOAD); setFile(null); setTitle(''); setExtractedTasks([]) }}
                className="btn-secondary">
                Procesar otra reunión
              </button>
              <button onClick={() => navigate('/')} className="btn-primary">
                Ver dashboard →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
