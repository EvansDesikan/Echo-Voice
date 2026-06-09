import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { ADMIN_KEY_STORAGE, adminApi } from '../../api/client'

export default function AdminLoginPage() {
  const { T } = useLang()
  const t = (key: string) => (T as unknown as Record<string, string>)[key] ?? key
  const navigate = useNavigate()
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    sessionStorage.setItem(ADMIN_KEY_STORAGE, key)
    try {
      await adminApi.getStats()
      navigate('/admin/dashboard')
    } catch (err: any) {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE)
      setError(t('admin_login_err'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '2rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--surface)',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔐</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{t('admin_login_title')}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {t('admin_login_subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            {t('admin_login_key_label')}
          </label>
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder={t('admin_login_key_placeholder')}
            required
            autoFocus
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '1rem',
              boxSizing: 'border-box',
              marginBottom: '1rem',
            }}
          />
          {error && (
            <div style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !key.trim()}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: (!key.trim() || loading) ? 0.6 : 1,
            }}
          >
            {loading ? t('admin_loading') : t('admin_login_btn')}
          </button>
        </form>
      </div>
    </div>
  )
}
