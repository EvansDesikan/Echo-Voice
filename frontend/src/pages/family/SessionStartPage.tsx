import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../../components/Nav'
import { startSessionByEmail } from '../../api/client'
import { useLang } from '../../context/LanguageContext'

export default function SessionStartPage() {
  const navigate = useNavigate()
  const { T } = useLang()
  const [email, setEmail] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleStart() {
    if (!email.trim()) { setError(T.session_err_empty); return }
    setLoading(true)
    setError('')
    try {
      const session = await startSessionByEmail({
        email: email.trim().toLowerCase(),
        family_member_name: familyName.trim() || undefined,
      })
      localStorage.setItem('echo_session_id', session.session_id)
      localStorage.setItem('echo_persona_name', session.client_name)
      navigate(`/family/chat/${session.session_id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : T.session_err_failed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-subtle)' }}>
      <Nav />

      {/* Disclosure */}
      <div className="disclosure-banner">
        <div className="disclosure-banner__dot" />
        <p className="disclosure-banner__text">
          {T.disclosure_generic}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 128px)', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary-light), var(--primary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '1.6rem',
            }}>
              🕊
            </div>
            <h2 style={{ marginBottom: 10 }}>{T.session_title}</h2>
            <p style={{ fontSize: '0.95rem' }}>{T.session_subtitle}</p>
          </div>

          {/* Form */}
          <div className="card card--elevated">
            <div style={{ display: 'grid', gap: 18 }}>

              <div className="form-group">
                <label className="form-label">{T.session_email_label}</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder={T.session_email_placeholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleStart() }}
                  autoComplete="email"
                />
                <span className="form-hint">{T.session_email_hint}</span>
              </div>

              <div className="form-group">
                <label className="form-label">{T.session_name_label}</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder={T.session_name_placeholder}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleStart() }}
                />
                <span className="form-hint">{T.session_name_hint}</span>
              </div>

              {error && (
                <p style={{ color: 'var(--danger)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
              )}

              <button
                className="btn btn--primary btn--full btn--lg"
                onClick={handleStart}
                disabled={loading || !email.trim()}
              >
                {loading ? T.session_btn_loading : T.session_btn}
              </button>
            </div>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
            {T.session_crisis}{' '}
            <a href="tel:08001110111" style={{ color: 'var(--primary)' }}>
              {T.session_crisis_link}
            </a>{' '}
            {T.session_crisis_suffix}
          </p>
        </div>
      </div>
    </div>
  )
}
