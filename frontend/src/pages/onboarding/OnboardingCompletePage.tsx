import { Link } from 'react-router-dom'
import { CheckCircle, Heart, Mail } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

export default function OnboardingCompletePage() {
  const { T } = useLang()
  const name = localStorage.getItem('echo_client_name') || 'Ihr Profil'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      {/* Success mark */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #e8f5ee, #d0ede0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
      }}>
        <CheckCircle size={38} color="var(--success)" strokeWidth={1.5} />
      </div>

      <h1 style={{ marginBottom: 16, maxWidth: 540 }}>
        {T.complete_title_pre}{name}{T.complete_title_post}
      </h1>

      <p style={{ maxWidth: 500, marginBottom: 12, fontSize: '1.05rem' }}>
        {T.complete_p1}
      </p>

      <p style={{ maxWidth: 460, marginBottom: 32, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        {T.complete_p2}
      </p>

      {/* Email confirmation — replaces the on-screen code display */}
      <div style={{
        background: 'var(--bg-subtle)',
        border: '2px solid var(--primary-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 32px',
        maxWidth: 500,
        width: '100%',
        marginBottom: 32,
        textAlign: 'center',
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--primary-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Mail size={24} color="var(--primary)" />
        </div>
        <h4 style={{ fontFamily: 'var(--font-display)', marginBottom: 10 }}>
          {T.complete_access_code_title}
        </h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
          {T.complete_access_code_desc}
        </p>
      </div>

      {/* What happens next */}
      <div style={{
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 32px',
        maxWidth: 500,
        width: '100%',
        marginBottom: 36,
        textAlign: 'left',
      }}>
        <h4 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>{T.complete_next_title}</h4>
        {[
          T.complete_next1,
          T.complete_next2,
          T.complete_next3,
          T.complete_next4,
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 3 ? 14 : 0 }}>
            <span style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}>
              {i + 1}
            </span>
            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.55 }}>{item}</p>
          </div>
        ))}
      </div>

      {/* Emotional note */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: 'var(--text-muted)',
        marginBottom: 36,
        fontSize: '0.875rem',
      }}>
        <Heart size={15} color="var(--primary)" />
        <span>{T.complete_gift}</span>
      </div>

      <Link to="/" className="btn btn--ghost">
        {T.complete_back}
      </Link>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 24, maxWidth: 440 }}>
        {T.complete_disclaimer}
      </p>
    </div>
  )
}
