import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { adminApi, ADMIN_KEY_STORAGE, AdminStats, AdminClientRow } from '../../api/client'

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${(seconds / 60).toFixed(1)} min`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ complete }: { complete: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.6rem',
      borderRadius: '99px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: complete ? '#dcfce7' : '#fef9c3',
      color: complete ? '#166534' : '#854d0e',
    }}>
      {complete ? '✓ Complete' : '⏳ Partial'}
    </span>
  )
}

function CloneBadge({ has }: { has: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.6rem',
      borderRadius: '99px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: has ? '#dbeafe' : '#f1f5f9',
      color: has ? '#1e40af' : '#64748b',
    }}>
      {has ? '🎙 Yes' : '— No'}
    </span>
  )
}

export default function AdminDashboardPage() {
  const { T } = useLang()
  const t = (key: string) => (T as unknown as Record<string, string>)[key] ?? key
  const navigate = useNavigate()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [clients, setClients] = useState<AdminClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [s, c] = await Promise.all([adminApi.getStats(), adminApi.listClients()])
      setStats(s)
      setClients(c)
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE)
        navigate('/admin')
        return
      }
      setError(t('admin_error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteClone(client: AdminClientRow) {
    if (!confirm(t('admin_confirm_delete_clone'))) return
    setActionLoading(`clone-${client.id}`)
    try {
      await adminApi.deleteVoiceClone(client.id)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteRecordings(client: AdminClientRow) {
    if (!confirm(t('admin_confirm_delete_recordings'))) return
    setActionLoading(`recs-${client.id}`)
    try {
      await adminApi.deleteRecordings(client.id)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteClient(client: AdminClientRow) {
    if (!confirm(t('admin_confirm_delete_client'))) return
    setActionLoading(`del-${client.id}`)
    try {
      await adminApi.deleteClient(client.id)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  function logout() {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE)
    navigate('/admin')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>{t('admin_loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#dc2626' }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>ECHO Voice Admin</h1>
        <button
          onClick={logout}
          style={{
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            cursor: 'pointer',
            color: 'var(--text)',
            fontSize: '0.85rem',
          }}
        >
          {t('admin_logout')}
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          {[
            { label: t('admin_stat_clients'), value: stats.total_clients },
            { label: t('admin_stat_clones'), value: stats.total_clones },
            { label: t('admin_stat_complete'), value: stats.total_complete },
            { label: t('admin_stat_duration'), value: fmtDuration(stats.total_duration_seconds) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Client table */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                {[
                  t('admin_col_name'), t('admin_col_email'), t('admin_col_lang'),
                  t('admin_col_status'), t('admin_col_clone'),
                  t('admin_col_recordings'), t('admin_col_duration'),
                  t('admin_col_access_code'),
                  t('admin_col_registered'), t('admin_col_actions'),
                ].map(col => (
                  <th key={col} style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No clients yet.
                  </td>
                </tr>
              )}
              {clients.map((c, i) => (
                <tr key={c.id} style={{
                  borderBottom: i < clients.length - 1 ? '1px solid var(--border)' : 'none',
                  background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>{c.language}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <StatusBadge complete={c.onboarding_complete} />
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <CloneBadge has={c.has_voice_clone} />
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{c.recording_count}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtDuration(c.total_duration_seconds)}</td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                    {c.family_access_code
                      ? <span style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--primary)' }}>
                          {`${c.family_access_code.slice(0, 4)}-${c.family_access_code.slice(4)}`}
                        </span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{fmtDate(c.created_at)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <ActionBtn
                        label={t('admin_action_view')}
                        onClick={() => navigate(`/admin/client/${c.id}`)}
                        variant="primary"
                      />
                      {c.has_voice_clone && (
                        <ActionBtn
                          label={actionLoading === `clone-${c.id}` ? '…' : t('admin_action_delete_clone')}
                          onClick={() => handleDeleteClone(c)}
                          variant="warning"
                          disabled={!!actionLoading}
                        />
                      )}
                      {c.recording_count > 0 && (
                        <ActionBtn
                          label={actionLoading === `recs-${c.id}` ? '…' : t('admin_action_delete_recordings')}
                          onClick={() => handleDeleteRecordings(c)}
                          variant="warning"
                          disabled={!!actionLoading}
                        />
                      )}
                      <ActionBtn
                        label={actionLoading === `del-${c.id}` ? '…' : t('admin_action_delete_client')}
                        onClick={() => handleDeleteClient(c)}
                        variant="danger"
                        disabled={!!actionLoading}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({
  label, onClick, variant, disabled,
}: {
  label: string
  onClick: () => void
  variant: 'primary' | 'warning' | 'danger'
  disabled?: boolean
}) {
  const colors = {
    primary: { bg: 'var(--accent)', color: '#fff' },
    warning: { bg: '#fef3c7', color: '#92400e' },
    danger: { bg: '#fee2e2', color: '#991b1b' },
  }
  const { bg, color } = colors[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.3rem 0.6rem',
        background: bg,
        color,
        border: 'none',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
