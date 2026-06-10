import { useState, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, MessageCircle, Check } from 'lucide-react'
import OnboardingLayout from '../../components/OnboardingLayout'
import PhraseRecorder from '../../components/PhraseRecorder'
import { submitPhrases } from '../../api/client'
import { useLang } from '../../context/LanguageContext'

export default function PhraseBankPage() {
  const navigate = useNavigate()
  const { T } = useLang()
  const [phrases, setPhrases] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recordingPhrase, setRecordingPhrase] = useState<string | null>(null)
  const [recordedPhrases, setRecordedPhrases] = useState<Set<string>>(new Set())

  function addPhrase(text: string) {
    const trimmed = text.trim()
    if (!trimmed || phrases.includes(trimmed) || phrases.length >= 50) return
    setPhrases((prev) => [...prev, trimmed])
    setInput('')
  }

  function removePhrase(phrase: string) {
    setPhrases((prev) => prev.filter((p) => p !== phrase))
    setRecordedPhrases((prev) => { const s = new Set(prev); s.delete(phrase); return s })
    if (recordingPhrase === phrase) setRecordingPhrase(null)
  }

  function handleRecorded(originalPhrase: string, correctedPhrase: string) {
    if (correctedPhrase !== originalPhrase) {
      setPhrases((prev) => prev.map((p) => p === originalPhrase ? correctedPhrase : p))
    }
    setRecordedPhrases((prev) => new Set(prev).add(correctedPhrase))
    setRecordingPhrase(null)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addPhrase(input) }
  }

  async function handleSubmit() {
    const clientId = localStorage.getItem('echo_client_id')
    if (!clientId) { navigate('/onboarding/consent'); return }

    setLoading(true)
    setError('')
    try {
      await submitPhrases({ client_id: clientId, phrases })
      navigate('/onboarding/memories')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ein Fehler ist aufgetreten.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <OnboardingLayout currentStep={3}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>{T.phrases_title}</h2>
        <p>{T.phrases_subtitle}</p>
      </div>

      {/* Vorschläge */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 16, fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
          {T.phrases_suggested_title}
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {T.phrases_suggested.filter((s) => !phrases.includes(s)).map((s) => (
            <button
              key={s}
              onClick={() => addPhrase(s)}
              style={{
                background: 'var(--bg-subtle)',
                border: '1.5px dashed var(--border)',
                borderRadius: 'var(--radius-full)',
                padding: '6px 14px',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 200ms',
              }}
              onMouseEnter={(e) => {
                const t = e.currentTarget
                t.style.borderColor = 'var(--primary)'
                t.style.color = 'var(--primary)'
              }}
              onMouseLeave={(e) => {
                const t = e.currentTarget
                t.style.borderColor = 'var(--border)'
                t.style.color = 'var(--text-secondary)'
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="card card--elevated" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 16, fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
          {T.phrases_input_title}
        </h4>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <MessageCircle size={16} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }} />
            <input
              className="form-input"
              type="text"
              placeholder={T.phrases_input_placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              style={{ paddingLeft: 36 }}
              maxLength={120}
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={() => addPhrase(input)}
            disabled={!input.trim()}
          >
            <Plus size={16} /> {T.phrases_btn_add}
          </button>
        </div>
        <p className="form-hint" style={{ marginTop: 8 }}>
          {T.phrases_hint}
        </p>

        {/* Added phrases */}
        {phrases.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              {phrases.length} {T.phrases_count}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {phrases.map((p) => {
                const clientId = localStorage.getItem('echo_client_id') || ''
                const isRecorded = recordedPhrases.has(p)
                const isRecording = recordingPhrase === p
                return (
                  <div key={p}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="phrase-pill" style={{ flexShrink: 0 }}>
                        {p}
                        <button
                          className="phrase-pill__remove"
                          onClick={() => removePhrase(p)}
                          title="Entfernen"
                        >
                          <X size={13} />
                        </button>
                      </span>
                      {isRecorded ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
                          <Check size={13} /> Aufgenommen
                        </span>
                      ) : (
                        <button
                          onClick={() => setRecordingPhrase(isRecording ? null : p)}
                          style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-full)',
                            padding: '3px 10px',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          {(T as unknown as Record<string, string>).phrase_rec_btn ?? 'Aufnehmen'}
                        </button>
                      )}
                    </div>
                    {isRecording && (
                      <PhraseRecorder
                        phrase={p}
                        clientId={clientId}
                        onRecorded={(corrected) => handleRecorded(p, corrected)}
                        onCancel={() => setRecordingPhrase(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: 16 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn--ghost" onClick={() => navigate('/onboarding/quiz')}>
          {T.phrases_btn_back}
        </button>
        <button
          className="btn btn--primary btn--lg"
          style={{ flex: 1 }}
          onClick={handleSubmit}
          disabled={phrases.length < 3 || loading}
        >
          {loading ? T.phrases_btn_saving : T.phrases_btn_next}
        </button>
      </div>

      {phrases.length < 3 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
          {T.phrases_min}
        </p>
      )}
    </OnboardingLayout>
  )
}
