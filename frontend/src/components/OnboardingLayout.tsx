import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import type { Lang } from '../i18n/translations'

const STEP_PATHS = [
  '/onboarding/consent',
  '/onboarding/voice',
  '/onboarding/quiz',
  '/onboarding/phrases',
  '/onboarding/memories',
]

interface Props {
  currentStep: number
  children: React.ReactNode
}

export default function OnboardingLayout({ currentStep, children }: Props) {
  const { lang, setLang, T } = useLang()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-subtle)' }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border-light)' }}>
        <div className="container" style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--text)', textDecoration: 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
              {T.nav_brand}
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Language toggle */}
              <div style={{ display: 'flex', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {(['de', 'en'] as Lang[]).map((l) => (
                  <button key={l} onClick={() => setLang(l)} style={{
                    padding: '4px 11px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: lang === l ? 'var(--primary)' : 'transparent',
                    color: lang === l ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 150ms', fontFamily: 'var(--font-body)',
                  }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {T.ob_step_of} {currentStep + 1} {T.ob_of} {STEP_PATHS.length}
              </span>
            </div>
          </div>

          {/* Step indicator */}
          <div className="step-indicator">
            {STEP_PATHS.map((_, i) => (
              <div key={i} className="step-indicator__item">
                <div className={[
                  'step-indicator__dot',
                  i === currentStep ? 'step-indicator__dot--active' : '',
                  i < currentStep ? 'step-indicator__dot--done' : '',
                ].join(' ')}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                {i < STEP_PATHS.length - 1 && (
                  <div className={['step-indicator__line', i < currentStep ? 'step-indicator__line--done' : ''].join(' ')} />
                )}
              </div>
            ))}
          </div>

          <div className="progress-bar" style={{ marginTop: 8 }}>
            <div className="progress-bar__fill" style={{ width: `${(currentStep / (STEP_PATHS.length - 1)) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="container container--narrow" style={{ padding: '48px 24px 80px' }}>
        {children}
      </div>
    </div>
  )
}
