import { useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { transcribeMemoryAudio } from '../api/client'

interface Props {
  clientId: string
  onTranscribed: (text: string) => void
}

type State = 'idle' | 'recording' | 'transcribing'

export default function VoiceMemoryInput({ clientId, onTranscribed }: Props) {
  const { T } = useLang()
  const t = (k: string) => (T as unknown as Record<string, string>)[k] ?? k

  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start()
      mediaRef.current = mr
      startTimeRef.current = Date.now()
      setState('recording')
    } catch {
      setError(t('phrase_rec_mic_denied'))
    }
  }

  async function stopRecording() {
    const mr = mediaRef.current
    if (!mr) return
    setState('transcribing')

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve()
      mr.stop()
      mr.stream.getTracks().forEach((t) => t.stop())
    })

    const duration = (Date.now() - startTimeRef.current) / 1000
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

    try {
      const result = await transcribeMemoryAudio(clientId, blob, duration)
      if (result.transcription) {
        onTranscribed(result.transcription)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('phrase_rec_error'))
    } finally {
      setState('idle')
    }
  }

  const label = state === 'recording'
    ? t('mem_voice_listening')
    : state === 'transcribing'
      ? t('mem_voice_transcribing')
      : t('mem_voice_btn')

  const isActive = state === 'recording'

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <button
        onPointerDown={state === 'idle' ? startRecording : undefined}
        onPointerUp={state === 'recording' ? stopRecording : undefined}
        onPointerLeave={state === 'recording' ? stopRecording : undefined}
        disabled={state === 'transcribing'}
        title={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 'var(--radius-full)',
          border: `1.5px solid ${isActive ? '#dc2626' : 'var(--border)'}`,
          background: isActive ? '#fee2e2' : 'var(--bg-subtle)',
          color: isActive ? '#dc2626' : 'var(--text-secondary)',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: state === 'transcribing' ? 'wait' : 'pointer',
          transition: 'all 150ms',
          animation: isActive ? 'pulse 1s infinite' : 'none',
        }}
      >
        <Mic size={14} />
        {label}
      </button>
      {error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{error}</span>
      )}
    </div>
  )
}
