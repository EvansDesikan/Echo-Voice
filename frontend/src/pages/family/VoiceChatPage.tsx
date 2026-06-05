import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Mic, Square, PhoneOff, MessageSquare, Volume2 } from 'lucide-react'
import { openVoiceSocket, textChat, endSession, DEMO_MODE } from '../../api/client'
import { useLang } from '../../context/LanguageContext'

type Mode = 'voice' | 'text'
type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface ChatMessage {
  role: 'user' | 'agent'
  text: string
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function VoiceChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { T } = useLang()
  const personaName = localStorage.getItem('echo_persona_name') || 'ECHO'

  const [mode, setMode] = useState<Mode>(DEMO_MODE ? 'text' : 'voice')
  const [agentState, setAgentState] = useState<AgentState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>(
    DEMO_MODE ? [{ role: 'agent', text: T.chat_demo_greeting }] : []
  )
  const [textInput, setTextInput] = useState('')
  const [sessionTime, setSessionTime] = useState(0)
  const [ending, setEnding] = useState(false)
  const [wsError, setWsError] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Session timer
  useEffect(() => {
    timerRef.current = setInterval(() => setSessionTime((t) => t + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // WebSocket setup (skipped entirely in demo mode)
  const connectWs = useCallback(() => {
    if (!sessionId || DEMO_MODE) return
    const ws = openVoiceSocket(sessionId)
    wsRef.current = ws

    ws.onopen = () => setWsError('')

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data)
      if (data.error) { setWsError(data.error); return }
      if (data.type === 'audio_response' && data.audio) {
        const blob = new Blob(
          [Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))],
          { type: 'audio/mpeg' },
        )
        const url = URL.createObjectURL(blob)
        if (audioRef.current) {
          audioRef.current.src = url
          audioRef.current.onplay = () => setAgentState('speaking')
          audioRef.current.onended = () => { setAgentState('idle'); URL.revokeObjectURL(url) }
          audioRef.current.play().catch(() => setAgentState('idle'))
        }
      }
    }

    ws.onerror = () => setWsError(T.chat_ws_error)
    ws.onclose = () => {}
  }, [sessionId])

  useEffect(() => {
    connectWs()
    audioRef.current = new Audio()
    return () => {
      wsRef.current?.close()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    }
  }, [connectWs])

  // ── Voice recording ────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        sendAudio(blob)
      }

      mr.start(100)
      setAgentState('listening')
    } catch {
      setWsError(T.chat_mic_denied)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setAgentState('thinking')
  }

  function sendAudio(blob: Blob) {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ audio: base64 }))
      }
    }
    reader.readAsDataURL(blob)
  }

  // ── Text chat ──────────────────────────────────────────────────────────────
  async function sendText() {
    if (!textInput.trim() || !sessionId) return
    const msg = textInput.trim()
    setTextInput('')
    setMessages((prev) => [...prev, { role: 'user', text: msg }])
    setAgentState('thinking')

    try {
      const res = await textChat({ session_id: sessionId, message: msg })
      setMessages((prev) => [...prev, { role: 'agent', text: res.response }])
    } finally {
      setAgentState('idle')
    }
  }

  // ── End session ────────────────────────────────────────────────────────────
  async function handleEnd() {
    setEnding(true)
    if (sessionId) await endSession(sessionId).catch(() => {})
    wsRef.current?.close()
    navigate('/family')
  }

  // ── Agent status label ─────────────────────────────────────────────────────
  const statusLabel: Record<AgentState, string> = {
    idle: T.chat_waiting,
    listening: T.chat_listening,
    thinking: T.chat_thinking,
    speaking: T.chat_speaking,
  }

  const isRecording = agentState === 'listening'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Disclosure banner */}
      <div className="disclosure-banner">
        <div className="disclosure-banner__dot" />
        <p className="disclosure-banner__text">
          {T.chat_disclosure(personaName)}
        </p>
      </div>

      {/* Header */}
      <div style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border-light)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-light), var(--primary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontSize: '0.9rem',
          }}>
            {initials(personaName)}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>
              {personaName}
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: agentState === 'speaking' ? 'var(--primary)' : 'var(--text-muted)' }}>
              {statusLabel[agentState]}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Mode toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius)',
            padding: 3,
            gap: 2,
          }}>
            {(['voice', 'text'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  background: mode === m ? '#fff' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: mode === m ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 200ms',
                }}
              >
                {m === 'voice' ? <Volume2 size={13} /> : <MessageSquare size={13} />}
                {m === 'voice' ? T.chat_voice_mode : T.chat_text_mode}
              </button>
            ))}
          </div>

          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(sessionTime)}
          </span>

          <button
            className="btn btn--danger btn--sm"
            onClick={handleEnd}
            disabled={ending}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <PhoneOff size={13} />
            {T.chat_btn_end}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {wsError && (
        <div style={{ background: '#fdf2f2', borderBottom: '1px solid #f5c6cb', padding: '10px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>{wsError}</p>
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {mode === 'voice' ? (
          // ── VOICE MODE ──────────────────────────────────────────────────────
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '40px 24px' }}>

            {/* Avatar */}
            <div className={`voice-avatar ${agentState === 'speaking' ? 'voice-avatar--speaking' : ''}`}>
              {initials(personaName)}
            </div>

            {/* Agent state */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--text)', margin: 0 }}>
                {personaName}
              </p>
              <p style={{
                fontSize: '0.875rem',
                color: agentState === 'speaking' ? 'var(--primary)' : 'var(--text-muted)',
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}>
                {agentState === 'speaking' && (
                  <span className="waveform" style={{ height: 14 }}>
                    {[...Array(6)].map((_, i) => (
                      <span key={i} className="waveform__bar" style={{ width: 2 }} />
                    ))}
                  </span>
                )}
                {statusLabel[agentState]}
              </p>
            </div>

            {/* Recent messages */}
            {messages.length > 0 && (
              <div style={{ maxWidth: 480, width: '100%', maxHeight: 120, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 32,
                  background: 'linear-gradient(to bottom, var(--bg), transparent)',
                  zIndex: 1,
                  pointerEvents: 'none',
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, overflow: 'hidden' }}>
                  {messages.slice(-2).map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div className={`chat-bubble chat-bubble--${m.role}`} style={{ maxWidth: '85%', fontSize: '0.875rem' }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mic button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              {isRecording ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="waveform">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="waveform__bar" />
                      ))}
                    </div>
                    <div className="rec-indicator"><div className="rec-indicator__dot" />{T.voice_recording}</div>
                    <div className="waveform">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="waveform__bar" />
                      ))}
                    </div>
                  </div>
                  <button
                    className="mic-btn mic-btn--recording"
                    onClick={stopRecording}
                    title="Aufnahme senden"
                  >
                    <Square size={22} />
                  </button>
                  <p style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{T.chat_stop_hint}</p>
                </>
              ) : (
                <>
                  <button
                    className="mic-btn"
                    onClick={startRecording}
                    disabled={agentState === 'thinking' || agentState === 'speaking'}
                    title="Sprechen"
                  >
                    <Mic size={28} />
                  </button>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {agentState === 'idle' ? T.chat_mic_hint_idle :
                     agentState === 'thinking' ? T.chat_mic_hint_thinking :
                     agentState === 'speaking' ? T.chat_mic_hint_speaking : ''}
                  </p>
                </>
              )}
            </div>
          </div>

        ) : (
          // ── TEXT MODE ────────────────────────────────────────────────────────
          <>
            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                    {T.chat_empty_title}
                  </p>
                  <p style={{ fontSize: '0.82rem', marginTop: 8 }}>
                    {T.chat_empty_sub(personaName)}
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.role === 'agent' && (
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-display)',
                      flexShrink: 0,
                      marginRight: 8,
                      alignSelf: 'flex-end',
                    }}>
                      {initials(personaName)}
                    </div>
                  )}
                  <div className={`chat-bubble chat-bubble--${m.role}`}>
                    {m.text}
                  </div>
                </div>
              ))}

              {agentState === 'thinking' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#fff', fontFamily: 'var(--font-display)' }}>
                    {initials(personaName)}
                  </div>
                  <div style={{ display: 'flex', gap: 4, padding: '10px 16px', background: 'var(--bg-subtle)', borderRadius: 12, border: '1px solid var(--border-light)' }}>
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} style={{
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)',
                        animation: 'blink 1.2s ease-in-out infinite',
                        animationDelay: `${delay}ms`,
                        display: 'block',
                      }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Text input */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              gap: 10,
              background: 'var(--bg)',
            }}>
              <input
                className="form-input"
                type="text"
                placeholder={T.chat_input_placeholder(personaName)}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }}
                disabled={agentState === 'thinking'}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn--primary"
                onClick={sendText}
                disabled={!textInput.trim() || agentState === 'thinking'}
              >
                {T.chat_btn_send}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Crisis footer */}
      <div style={{
        padding: '10px 24px',
        borderTop: '1px solid var(--border-light)',
        background: 'var(--bg-subtle)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
          {T.chat_crisis}{' '}
          <a href="tel:08001110111" style={{ color: 'var(--primary)', fontWeight: 500 }}>
            {T.chat_crisis_link}
          </a>{' '}
          {T.chat_crisis_suffix}
        </p>
      </div>
    </div>
  )
}
