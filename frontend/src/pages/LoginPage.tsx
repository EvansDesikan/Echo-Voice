import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import { login } from '../api/client'

export default function LoginPage() {
  const { T } = useLang()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await login(email.trim())
      localStorage.setItem('echo_client_id', data.client_id)
      localStorage.setItem('echo_client_name', data.client_name)
      localStorage.setItem('echo_persona_name', data.client_name)

      if (data.onboarding_complete) {
        navigate('/family')
      } else if (!data.has_personality) {
        navigate('/onboarding/voice')
      } else if (!data.has_phrases) {
        navigate('/onboarding/phrases')
      } else {
        navigate('/onboarding/memories')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        setError(T.login_err_not_found)
      } else {
        setError(T.login_err_failed)
      }
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
              ECHO Voice
            </span>
          </Link>
        </div>

        <div className="card card--elevated" style={{ padding: '36px 32px' }}>
          <h2 style={{ marginBottom: 8, fontFamily: 'var(--font-display)' }}>{T.login_title}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontSize: '0.9rem', lineHeight: 1.6 }}>
            {T.login_subtitle}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">{T.login_email_label}</label>
              <input
                type="email"
                className="form-input"
                placeholder={T.login_email_placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {error && (
              <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: 16 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn--primary btn--full btn--lg"
              disabled={loading || !email.trim()}
            >
              {loading ? T.login_btn_loading : T.login_btn}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {T.login_no_account}{' '}
            <Link to="/onboarding/consent" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
              {T.login_signup_link}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
