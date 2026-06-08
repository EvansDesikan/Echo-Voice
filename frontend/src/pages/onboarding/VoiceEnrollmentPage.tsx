import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square, CheckCircle, ChevronRight, Loader2, Upload } from 'lucide-react'
import OnboardingLayout from '../../components/OnboardingLayout'
import { useLang } from '../../context/LanguageContext'
import { uploadVoiceRecording, createVoiceClone, getVoiceRecordings } from '../../api/client'

type RecordingState = 'idle' | 'recording' | 'done'

interface Recording {
  blob: Blob
  url: string
  type: 'scripted' | 'spontaneous'
  label: string
  duration: number
  uploaded: boolean
  index: number
}

export default function VoiceEnrollmentPage() {
  const navigate = useNavigate()
  const { T } = useLang()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [state, setState] = useState<RecordingState>('idle')
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [phase, setPhase] = useState<'scripted' | 'spontaneous'>('scripted')
  const [elapsed, setElapsed] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPhase, setUploadPhase] = useState<'uploading' | 'cloning' | 'done' | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // Refs to capture live values inside MediaRecorder callbacks (avoids stale closures)
  const elapsedRef = useRef(0)
  const phaseRef = useRef<'scripted' | 'spontaneous'>('scripted')
  const currentPromptRef = useRef('')
  const nextRecordingIndexRef = useRef(0)

  // Load any recordings already uploaded in a previous session and restore prompt position
  useEffect(() => {
    const clientId = localStorage.getItem('echo_client_id')
    if (!clientId) return
    getVoiceRecordings(clientId).then(({ recordings }) => {
      if (recordings.length === 0) return
      const restored: Recording[] = recordings.map((r) => ({
        blob: new Blob([], { type: 'audio/webm' }),  // placeholder — audio is already on R2
        url: r.playback_url,  // presigned R2 URL — valid for 1 hour
        type: r.recording_type,
        label: r.label,
        duration: r.duration_seconds,
        uploaded: true,
        index: r.index,
      }))
      setRecordings(restored)
      nextRecordingIndexRef.current = recordings.length

      // Restore phase and prompt position from recorded counts
      const scriptedDone = recordings.filter((r) => r.recording_type === 'scripted').length
      const spontaneousDone = recordings.filter((r) => r.recording_type === 'spontaneous').length
      const scriptedTotal = T.voice_scripted_prompts.length
      const spontaneousTotal = T.voice_spontaneous_topics.length

      if (scriptedDone < scriptedTotal) {
        // Still in scripted phase — land on the next unrecorded scripted prompt
        setPhase('scripted')
        setCurrentPromptIndex(scriptedDone)
      } else if (spontaneousDone < spontaneousTotal) {
        // Scripted complete, in spontaneous phase
        setPhase('spontaneous')
        setCurrentPromptIndex(spontaneousDone)
      }
      // If both complete, leave phase/index as-is — allDone will be true
    }).catch(() => {/* silent — fresh session if fetch fails */})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const prompts = phase === 'scripted' ? T.voice_scripted_prompts : T.voice_spontaneous_topics
  const notes = phase === 'scripted' ? T.voice_scripted_notes : T.voice_spontaneous_topics_notes
  const currentPrompt = prompts[currentPromptIndex]
  const currentNote = notes[currentPromptIndex]

  // Keep refs in sync so MediaRecorder callbacks always see live values
  phaseRef.current = phase
  currentPromptRef.current = currentPrompt
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
      const clientId = localStorage.getItem('echo_client_id') ?? ''
      // Use refs — not state — to get live values at stop time (fixes stale closure)
      const timerDuration = elapsedRef.current
      const capturedPhase = phaseRef.current
      const capturedLabel = currentPromptRef.current.slice(0, 80)
      // Use a stable monotonic index — not array.length — to avoid redo collisions
      const index = nextRecordingIndexRef.current
      nextRecordingIndexRef.current += 1

      // Add to state immediately with timer duration as placeholder
      setRecordings((prev) => [...prev, {
        blob, url, type: capturedPhase, label: capturedLabel,
        duration: timerDuration, uploaded: false, index,
      }])
      setState('done')

      // Get real duration from audio element metadata, then upload with accurate value
      const audio = new Audio(url)
      audio.addEventListener('loadedmetadata', () => {
        const realDuration = isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : timerDuration
        setRecordings((rs) =>
          rs.map((r) => (r.index === index ? { ...r, duration: realDuration } : r))
        )
        uploadVoiceRecording(clientId, blob, capturedPhase, index, realDuration, capturedLabel)
          .then(() => {
            setRecordings((rs) =>
              rs.map((r) => (r.index === index ? { ...r, uploaded: true } : r))
            )
          })
          .catch((err) => console.error(`Upload failed for recording ${index}:`, err))
      })
    }

    mr.start(100)
    setState('recording')
    elapsedRef.current = 0
    setElapsed(0)
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorder.current?.stop()
  }

  function redoRecording() {
    setRecordings((prev) => {
      const removed = prev[prev.length - 1]
      if (removed?.url) URL.revokeObjectURL(removed.url)
      return prev.slice(0, -1)
    })
    setState('idle')
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
    const total = Math.round(s)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const allDone = phase === 'spontaneous' && currentPromptIndex === T.voice_spontaneous_topics.length - 1 && state === 'done'

  async function handleContinue() {
    const clientId = localStorage.getItem('echo_client_id') ?? ''
    setUploading(true)
    setUploadPhase('uploading')
    try {
      // Only upload recordings that failed to auto-upload
      const pending = recordings.filter((r) => !r.uploaded)
      for (let i = 0; i < pending.length; i++) {
        setUploadProgress(i + 1)
        await uploadVoiceRecording(clientId, pending[i].blob, pending[i].type, pending[i].index, pending[i].duration, pending[i].label)
      }
      setUploadPhase('cloning')
      await createVoiceClone(clientId)
      setUploadPhase('done')
      navigate('/onboarding/quiz')
    } catch (err) {
      console.error('Voice upload failed:', err)
      setUploading(false)
      setUploadPhase(null)
    }
  }

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
          marginBottom: 12,
          padding: '16px 20px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius)',
          borderLeft: '3px solid var(--primary)',
        }}>
          {currentPrompt}
        </p>

        <p style={{
          fontSize: '0.78rem',
          lineHeight: 1.6,
          color: 'var(--text-muted)',
          marginBottom: 24,
          padding: '8px 12px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-light)',
        }}>
          <strong style={{ color: 'var(--primary)', fontWeight: 600 }}>{T.voice_note_label}: </strong>
          {currentNote}
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
              title={T.voice_mic_start}
            >
              <Mic size={28} />
            </button>
          )}

          {state === 'recording' && (
            <button
              className="mic-btn mic-btn--recording"
              onClick={stopRecording}
              title={T.voice_mic_stop}
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
              <div style={{ display: 'flex', gap: 10, marginTop: 4, width: '100%' }}>
                <button
                  className="btn btn--secondary"
                  onClick={redoRecording}
                  style={{ flex: 1 }}
                >
                  {T.voice_btn_redo}
                </button>
                {!allDone && (
                  <button className="btn btn--primary" onClick={nextPrompt} style={{ flex: 2 }}>
                    {T.voice_btn_next} <ChevronRight size={16} />
                  </button>
                )}
              </div>
              {allDone && (
                <p style={{ fontSize: '0.82rem', color: 'var(--success)', textAlign: 'center', marginTop: 4, fontWeight: 500 }}>
                  {T.voice_all_done}
                </p>
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
                flexDirection: 'column',
                gap: 6,
                padding: '10px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.82rem', flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.label}
                  </span>
                  {r.uploaded
                    ? <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    : <Upload size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.6 }} />
                  }
                </div>
                {r.url && (
                  <audio
                    controls
                    src={r.url}
                    style={{ width: '100%', height: 32 }}
                    onLoadedMetadata={(e) => {
                      const real = e.currentTarget.duration
                      if (isFinite(real) && real > 0) {
                        setRecordings((rs) =>
                          rs.map((rec) => rec.index === r.index ? { ...rec, duration: real } : rec)
                        )
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn btn--primary btn--full btn--lg"
        onClick={handleContinue}
        disabled={totalDuration < 600 || uploading}
      >
        {uploading && <Loader2 size={16} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />}
        {uploadPhase === 'uploading'
          ? T.voice_uploading(uploadProgress, recordings.length)
          : uploadPhase === 'cloning'
          ? T.voice_creating_clone
          : uploadPhase === 'done'
          ? T.voice_upload_done
          : T.voice_btn_continue}
      </button>
      {totalDuration < 600 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
          {T.voice_btn_min}
        </p>
      )}
    </OnboardingLayout>
  )
}
