import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square, Play, CheckCircle, ChevronRight } from 'lucide-react'
import OnboardingLayout from '../../components/OnboardingLayout'
import { useLang } from '../../context/LanguageContext'

type RecordingState = 'idle' | 'recording' | 'done'

interface Recording {
  blob: Blob
  url: string
  type: 'scripted' | 'spontaneous'
  label: string
  duration: number
}

export default function VoiceEnrollmentPage() {
  const navigate = useNavigate()
  const { T } = useLang()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [state, setState] = useState<RecordingState>('idle')
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [phase, setPhase] = useState<'scripted' | 'spontaneous'>('scripted')
  const [elapsed, setElapsed] = useState(0)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const prompts = phase === 'scripted' ? T.voice_scripted_prompts : T.voice_spontaneous_topics
  const currentPrompt = prompts[currentPromptIndex]
  const totalDuration = recordings.reduce((acc, r) => acc + r.duration, 0)
  const targetSeconds = 15 * 60 // 15 minutes
  const progressPct = Math.min((totalDuration / targetSeconds) * 100, 100)

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunksRef.current = []
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    mediaRecorder.current = mr

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      setRecordings((prev) => [
        ...prev,
        {
          blob,
          url,
          type: phase,
          label: currentPrompt.slice(0, 50) + '…',
          duration: elapsed,
        },
      ])
      setState('done')
    }

    mr.start(100)
    setState('recording')
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorder.current?.stop()
  }

  function nextPrompt() {
    const nextIdx = currentPromptIndex + 1
    if (nextIdx < prompts.length) {
      setCurrentPromptIndex(nextIdx)
      setState('idle')
    } else if (phase === 'scripted') {
      setPhase('spontaneous')
      setCurrentPromptIndex(0)
      setState('idle')
    } else {
      // done with all prompts
    }
  }

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const allDone = phase === 'spontaneous' && currentPromptIndex === T.voice_spontaneous_topics.length - 1 && state === 'done'

  return (
    <OnboardingLayout currentStep={1}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>{T.voice_title}</h2>
        <p>{T.voice_subtitle}</p>
      </div>

      {/* Progress */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' }}>
            {T.voice_progress_label}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
            {formatTime(totalDuration)} / {T.voice_progress_target}
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${progressPct}%` }} />
        </div>
        {recordings.length > 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
            {recordings.length} {T.voice_recordings_count}
          </p>
        )}
      </div>

      {/* Current prompt */}
      <div className="card card--elevated" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {phase === 'scripted' ? T.voice_badge_script : T.voice_badge_free}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {currentPromptIndex + 1} / {prompts.length}
          </span>
        </div>

        <p style={{
          fontSize: '1.1rem',
          lineHeight: 1.7,
          color: 'var(--text)',
          fontFamily: 'var(--font-display)',
          marginBottom: 28,
          padding: '16px 20px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius)',
          borderLeft: '3px solid var(--primary)',
        }}>
          {currentPrompt}
        </p>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {state === 'recording' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div className="waveform">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="waveform__bar" />
                ))}
              </div>
              <div className="rec-indicator">
                <div className="rec-indicator__dot" />
                {formatTime(elapsed)}
              </div>
              <div className="waveform">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="waveform__bar" />
                ))}
              </div>
            </div>
          )}

          {state === 'idle' && (
            <button
              className="mic-btn"
              onClick={startRecording}
              title="Aufnahme starten"
            >
              <Mic size={28} />
            </button>
          )}

          {state === 'recording' && (
            <button
              className="mic-btn mic-btn--recording"
              onClick={stopRecording}
              title="Aufnahme stoppen"
            >
              <Square size={22} />
            </button>
          )}

          {state === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}>
                <CheckCircle size={18} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{T.voice_rec_saved}</span>
              </div>
              {recordings.length > 0 && (
                <audio
                  controls
                  src={recordings[recordings.length - 1].url}
                  style={{ width: '100%', height: 36 }}
                />
              )}
              {!allDone && (
                <button className="btn btn--primary" onClick={nextPrompt} style={{ marginTop: 4 }}>
                  {T.voice_btn_next} <ChevronRight size={16} />
                </button>
              )}
            </div>
          )}

          {state === 'idle' && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320 }}>
              {T.voice_idle_hint}
            </p>
          )}
        </div>
      </div>

      {/* Previous recordings list */}
      {recordings.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ marginBottom: 12, fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
            {T.voice_prev_title}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recordings.map((r, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius)',
              }}>
                <Play size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.label}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {formatTime(r.duration)}
                </span>
                <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn btn--primary btn--full btn--lg"
        onClick={() => navigate('/onboarding/quiz')}
        disabled={recordings.length < 3}
      >
        {T.voice_btn_continue}
      </button>
      {recordings.length < 3 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
          {T.voice_btn_min}
        </p>
      )}
    </OnboardingLayout>
  )
}
