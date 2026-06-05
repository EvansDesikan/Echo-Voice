import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/OnboardingLayout'
import { registerConsent } from '../../api/client'
import { useLang } from '../../context/LanguageContext'

export default function ConsentPage() {
  const navigate = useNavigate()
  const { T } = useLang()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [language, setLanguage] = useState<'de' | 'en'>('de')
  const [checks, setChecks] = useState({ c1: false, c2: false, c3: false, c4: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const allChecked = Object.values(checks).every(Boolean)
  const canSubmit = name.trim() && email.trim() && allChecked
  const toggle = (key: keyof typeof checks) => setChecks((p) => ({ ...p, [key]: !p[key] }))

  async function handleSubmit() {
    setLoading(true); setError('')
    try {
      const result = await registerConsent({ client_name: name.trim(), email: email.trim(), language, consented: true })
      localStorage.setItem('echo_client_id', result.client_id)
      localStorage.setItem('echo_client_name', name.trim())
      navigate('/onboarding/voice')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ein Fehler ist aufgetreten.')
    } finally { setLoading(false) }
  }

  return (
    <OnboardingLayout currentStep={0}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>{T.consent_title}</h2>
        <p>{T.consent_subtitle}</p>
      </div>

      <div className="card card--elevated" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 20, fontFamily: 'var(--font-display)' }}>{T.consent_info_title}</h4>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">{T.consent_name_label}</label>
            <input className="form-input" type="text" placeholder={T.consent_name_placeholder} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{T.consent_email_label}</label>
            <input className="form-input" type="email" placeholder={T.consent_email_placeholder} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{T.consent_lang_label}</label>
            <select className="form-select" value={language} onChange={(e) => setLanguage(e.target.value as 'de' | 'en')}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card card--elevated" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 20, fontFamily: 'var(--font-display)' }}>{T.consent_decl_title}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {([
            { key: 'c1' as const, text: T.consent_check1 },
            { key: 'c2' as const, text: T.consent_check2 },
            { key: 'c3' as const, text: T.consent_check3 },
            { key: 'c4' as const, text: T.consent_check4 },
          ]).map(({ key, text }) => (
            <label key={key} className="checkbox-group">
              <input type="checkbox" checked={checks[key]} onChange={() => toggle(key)} />
              <span className="checkbox-group__label">{text}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--primary-faint)', border: '1px solid rgba(21,119,155,0.2)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12 }}>
        <span style={{ color: 'var(--primary)', marginTop: 1 }}>ℹ</span>
        <p style={{ fontSize: '0.82rem', margin: 0, color: 'var(--primary-hover)' }}>{T.consent_gdpr_note}</p>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: 16 }}>{error}</p>}

      <button className="btn btn--primary btn--full btn--lg" onClick={handleSubmit} disabled={!canSubmit || loading}>
        {loading ? T.consent_btn_saving : T.consent_btn}
      </button>
    </OnboardingLayout>
  )
}
