import { Link, useLocation } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import type { Lang } from '../i18n/translations'

export default function Nav() {
  const location = useLocation()
  const isFamily = location.pathname.startsWith('/family')
  const { lang, setLang, T } = useLang()
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="nav">
      <div className="container nav__inner">
        <Link to="/" className="nav__brand">
          <span className="nav__brand-dot" />
          {T.nav_brand}
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Page links */}
          {!isFamily && (
            <ul className="nav__links">
              <li>
                <Link to="/onboarding/consent" className="nav__link">
                  {T.nav_create_profile}
                </Link>
              </li>
              <li>
                <Link to="/family" className="nav__link">
                  {T.nav_for_family}
                </Link>
              </li>
            </ul>
          )}

          {/* Theme toggle */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* Language toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}>
            {(['de', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  padding: '5px 13px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  border: 'none',
                  cursor: 'pointer',
                  background: lang === l ? 'var(--primary)' : 'transparent',
                  color: lang === l ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 150ms',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
