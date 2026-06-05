import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { DEMO_MODE } from '../api/client'

const PAGES = [
  { label: '🏠 Landing',           path: '/' },
  { label: '✅ 1. Consent',        path: '/onboarding/consent' },
  { label: '🎙 2. Voice Record',   path: '/onboarding/voice' },
  { label: '🧠 3. Questionnaire',  path: '/onboarding/quiz' },
  { label: '💬 4. Phrase Bank',    path: '/onboarding/phrases' },
  { label: '📖 5. Memories',       path: '/onboarding/memories' },
  { label: '🎉 6. Complete',       path: '/onboarding/complete' },
  { label: '─────────────',        path: '' },
  { label: '👨‍👩‍👧 Family Start',     path: '/family' },
  { label: '🔊 Voice Chat',        path: '/family/chat/demo-session-00000000-0000-0000-0000-000000000002' },
]

export default function DemoNav() {
  const [open, setOpen] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  if (!DEMO_MODE) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      fontFamily: 'var(--font-body)',
    }}>
      {open && (
        <div style={{
          background: '#1a1a2e',
          color: '#e0e0e0',
          borderRadius: 12,
          padding: '14px 0 8px',
          marginBottom: 10,
          width: 230,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            padding: '0 16px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 6,
          }}>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#15779b' }}>
              Demo Navigation
            </p>
            <p style={{ margin: '3px 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
              Click any page to preview
            </p>
          </div>

          {PAGES.map((page, i) => {
            if (!page.path) return (
              <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
            )
            const active = location.pathname === page.path
            return (
              <button
                key={page.path}
                onClick={() => navigate(page.path)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '7px 16px',
                  background: active ? 'rgba(21,119,155,0.25)' : 'transparent',
                  border: 'none',
                  borderLeft: active ? '3px solid #15779b' : '3px solid transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                  fontSize: '0.8rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  fontFamily: 'var(--font-body)',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.color = '#fff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                  }
                }}
              >
                {page.label}
              </button>
            )
          })}

          <div style={{ padding: '8px 16px 2px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
              All API calls are mocked · No backend needed
            </p>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#15779b',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '9px 16px',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(21,119,155,0.5)',
          width: '100%',
          justifyContent: 'center',
          fontFamily: 'var(--font-body)',
        }}
      >
        <span>{open ? '✕' : '◉'}</span>
        {open ? 'Close' : 'Demo Pages'}
      </button>
    </div>
  )
}
