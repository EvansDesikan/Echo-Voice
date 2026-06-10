import { useState, useRef } from 'react'
import { Mic, Check, X } from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { uploadPhraseRecording } from '../api/client'

interface Props {
  phrase: string
  clientId: string
  onRecorded: (correctedPhrase: string) => void
  onCancel: () => void
}

type RecState = 'idle' | 'recording' | 'transcribing' | 'confirm'

export default function PhraseRecorder({ phrase, clientId, onRecorded, onCancel }: Props) {
  const { T } = useLang()
  const t = (k: string) => (T as unknown as Record<string, string>)[k] ?? k

  const [state, setState] = useState<RecState>('idle')
  const [transcription, setTranscription] = useState(phrase)
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
      const result = await uploadPhraseRecording(clientId, blob, phrase, duration)
      setTranscription(result.transcription || phrase)
      setState('confirm')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('phrase_rec_error'))
      setState('idle')
    }
  }

  function handleConfirm() {
    onRecorded(transcription.trim() || phrase)
  }

  return (
    <div style={{
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius)',
      padding: '16px 18px',
      marginTop: 8,
    }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        {t('phrase_rec_title')}: <strong style={{ color: 'var(--text)' }}>"{phrase}"</strong>
      </p>

      {state === 'idle' && (
        <button
          onPointerDown={startRecording}
          className="btn btn--primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Mic size={15} /> {t('phrase_rec_btn')}
        </button>
      )}

      {state === 'recording' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#dc2626', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse 1s infinite',
            }}
          >
            <Mic size={20} color="#fff" />
          </button>
          <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>
            {t('phrase_rec_recording')}
          </span>
        </div>
      )}

      {state === 'transcribing' && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('phrase_rec_transcribing')}</p>
      )}

      {state === 'confirm' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t('phrase_rec_confirm_label')}
          </label>
          <input
            className="form-input"
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            style={{ fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" onClick={handleConfirm} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> {t('phrase_rec_confirm_btn')}
            </button>
            <button className="btn btn--ghost" onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={14} /> {t('phrase_rec_cancel_btn')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 8 }}>{error}</p>
      )}

      {state !== 'confirm' && state !== 'recording' && (
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8, padding: 0 }}
        >
          {t('phrase_rec_cancel_btn')}
        </button>
      )}
    </div>
  )
}
