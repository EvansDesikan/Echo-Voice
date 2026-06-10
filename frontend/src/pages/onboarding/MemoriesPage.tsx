import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, BookOpen } from 'lucide-react'
import OnboardingLayout from '../../components/OnboardingLayout'
import VoiceMemoryInput from '../../components/VoiceMemoryInput'
import { submitMemories, buildPersonality, createVoiceClone } from '../../api/client'
import { useLang } from '../../context/LanguageContext'

interface Memory {
  text: string
  memory_type: 'event' | 'value' | 'relationship' | 'phrase'
  source: 'client'
}

export default function MemoriesPage() {
  const navigate = useNavigate()
  const { T } = useLang()

  const TYPE_LABELS: Record<Memory['memory_type'], string> = {
    event: T.mem_type_event,
    value: T.mem_type_value,
    relationship: T.mem_type_relationship,
    phrase: T.mem_type_phrase,
  }

  const [memories, setMemories] = useState<Memory[]>([...T.mem_examples])
  const [text, setText] = useState('')
  const [type, setType] = useState<Memory['memory_type']>('event')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addMemory() {
    if (!text.trim()) return
    setMemories((prev) => [...prev, { text: text.trim(), memory_type: type, source: 'client' }])
    setText('')
  }

  function removeMemory(idx: number) {
    setMemories((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    const clientId = localStorage.getItem('echo_client_id')
    if (!clientId) { navigate('/onboarding/consent'); return }

    setLoading(true)
    setError('')
    try {
      await submitMemories({ client_id: clientId, memories })
      await buildPersonality(clientId)
      await createVoiceClone(clientId)
      navigate('/onboarding/complete')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ein Fehler ist aufgetreten.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <OnboardingLayout currentStep={4}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>{T.mem_title}</h2>
        <p>{T.mem_subtitle}</p>
      </div>

      {/* Add memory */}
      <div className="card card--elevated" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 16, fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
          {T.mem_add_title}
        </h4>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">{T.mem_type_label}</label>
            <select
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value as Memory['memory_type'])}
            >
              {(Object.keys(TYPE_LABELS) as Memory['memory_type'][]).map((k) => (
                <option key={k} value={k}>{TYPE_LABELS[k]}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>{T.mem_text_label}</label>
              <VoiceMemoryInput
                clientId={localStorage.getItem('echo_client_id') || ''}
                onTranscribed={(transcribed) => setText((prev) => prev ? `${prev} ${transcribed}` : transcribed)}
              />
            </div>
            <textarea
              className="form-textarea"
              placeholder={T.mem_text_placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ minHeight: 90 }}
              maxLength={500}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="form-hint">{T.mem_hint}</span>
              <span className="form-hint">{text.length}/500</span>
            </div>
          </div>

          <button
            className="btn btn--primary"
            onClick={addMemory}
            disabled={!text.trim()}
            style={{ alignSelf: 'flex-start' }}
          >
            <Plus size={16} /> {T.mem_btn_add}
          </button>
        </div>
      </div>

      {/* Memory list */}
      {memories.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BookOpen size={16} style={{ color: 'var(--primary)' }} />
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
              {memories.length} {T.mem_archive_count}
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {memories.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: 12,
                padding: '14px 16px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius)',
                alignItems: 'flex-start',
              }}>
                <span style={{
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  flexShrink: 0,
                  marginTop: 2,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {TYPE_LABELS[m.memory_type]}
                </span>
                <p style={{ flex: 1, margin: 0, fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.55 }}>
                  {m.text}
                </p>
                <button
                  onClick={() => removeMemory(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}
                  title="Entfernen"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: 16 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn--ghost" onClick={() => navigate('/onboarding/phrases')}>
          {T.mem_btn_back}
        </button>
        <button
          className="btn btn--primary btn--lg"
          style={{ flex: 1 }}
          onClick={handleSubmit}
          disabled={memories.length < 3 || loading}
        >
          {loading ? T.mem_btn_saving : T.mem_btn_finish}
        </button>
      </div>

      {memories.length < 3 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
          {T.mem_min}
        </p>
      )}
    </OnboardingLayout>
  )
}
