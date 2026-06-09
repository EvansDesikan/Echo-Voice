import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { adminApi, ADMIN_KEY_STORAGE, AdminClientDetail } from '../../api/client'

function fmtDuration(s: number) {
  if (s < 60) return `${Math.round(s)}s`
  return `${(s / 60).toFixed(1)} min`
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function OceanBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.7 ? '#16a34a' : value >= 0.4 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

const OCEAN_LABELS: Record<string, string> = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Neuroticism',
}

export default function AdminClientDetailPage() {
  const { T } = useLang()
  const t = (key: string) => (T as unknown as Record<string, string>)[key] ?? key
  const navigate = useNavigate()
  const { clientId } = useParams<{ clientId: string }>()
  const [client, setClient] = useState<AdminClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) return
    load()
  }, [clientId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.getClient(clientId!)
      setClient(data)
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

  async function handleDeleteClone() {
    if (!client || !confirm(t('admin_confirm_delete_clone'))) return
    setActionLoading('clone')
    try {
      await adminApi.deleteVoiceClone(client.id)
      await load()
    } catch (err: any) { alert(err.message) }
    finally { setActionLoading(null) }
  }

  async function handleDeleteRecordings() {
    if (!client || !confirm(t('admin_confirm_delete_recordings'))) return
    setActionLoading('recs')
    try {
      await adminApi.deleteRecordings(client.id)
      await load()
    } catch (err: any) { alert(err.message) }
    finally { setActionLoading(null) }
  }

  async function handleDeleteClient() {
    if (!client || !confirm(t('admin_confirm_delete_client'))) return
    setActionLoading('del')
    try {
      await adminApi.deleteClient(client.id)
      navigate('/admin/dashboard')
    } catch (err: any) {
      alert(err.message)
      setActionLoading(null)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>{t('admin_loading')}</p>
    </div>
  )

  if (error || !client) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#dc2626' }}>{error || t('admin_error')}</p>
    </div>
  )

  const totalDuration = client.recordings.reduce((s, r) => s + r.duration_seconds, 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Back + header */}
      <button
        onClick={() => navigate('/admin/dashboard')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.9rem', padding: 0, marginBottom: '1.5rem' }}
      >
        {t('admin_detail_back')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>{client.name}</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>{client.email} · {client.language.toUpperCase()} · Registered {fmtDateTime(client.created_at)}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {client.has_voice_clone && (
            <DangerBtn label={actionLoading === 'clone' ? '…' : t('admin_action_delete_clone')} onClick={handleDeleteClone} disabled={!!actionLoading} variant="warning" />
          )}
          {client.recordings.length > 0 && (
            <DangerBtn label={actionLoading === 'recs' ? '…' : t('admin_action_delete_recordings')} onClick={handleDeleteRecordings} disabled={!!actionLoading} variant="warning" />
          )}
          <DangerBtn label={actionLoading === 'del' ? '…' : t('admin_action_delete_client')} onClick={handleDeleteClient} disabled={!!actionLoading} variant="danger" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>

        {/* Identity card */}
        <Section title="Client Info">
          <InfoRow label="Status" value={client.onboarding_complete ? '✅ Onboarding complete' : '⏳ Onboarding in progress'} />
          <InfoRow label={t('admin_detail_voice_id')} value={client.elevenlabs_voice_id || t('admin_detail_none')} mono />
          <InfoRow label="Phrases" value={`${client.phrase_count} submitted`} />
          <InfoRow label="Total audio" value={fmtDuration(totalDuration)} />
          <InfoRow label="Consent given" value={client.consent_given ? `Yes — ${client.consent_timestamp ? fmtDateTime(client.consent_timestamp) : ''}` : 'No'} />
        </Section>

        {/* OCEAN scores */}
        <Section title={t('admin_detail_ocean')}>
          {client.ocean_scores ? (
            <>
              {Object.entries(client.ocean_scores).map(([key, val]) => (
                <OceanBar key={key} label={OCEAN_LABELS[key] || key} value={val} />
              ))}
              {client.behavioral_tags && client.behavioral_tags.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {t('admin_detail_tags')}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {client.behavioral_tags.map(tag => (
                      <span key={tag} style={{
                        padding: '0.2rem 0.6rem',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '99px',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('admin_detail_no_ocean')}</p>
          )}
        </Section>

        {/* Phrase bank */}
        <Section title={t('admin_detail_phrases')}>
          {client.phrase_bank.length === 0
            ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('admin_detail_no_phrases')}</p>
            : (
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.875rem' }}>
                {client.phrase_bank.map((p, i) => <li key={i} style={{ marginBottom: '0.3rem' }}>{p}</li>)}
              </ul>
            )
          }
        </Section>

        {/* Recordings */}
        <Section title={t('admin_detail_recordings')}>
          {client.recordings.length === 0
            ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('admin_detail_no_recordings')}</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Label</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Type</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {client.recordings.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.4rem 0.5rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</td>
                      <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{r.recording_type}</td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtDuration(r.duration_seconds)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ padding: '0.4rem 0.5rem', fontWeight: 700 }}>Total</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{fmtDuration(totalDuration)}</td>
                  </tr>
                </tbody>
              </table>
            )
          }
        </Section>

        {/* Sessions */}
        <Section title={t('admin_detail_sessions')}>
          {client.sessions.length === 0
            ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('admin_detail_no_sessions')}</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Family member</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Started</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Turns</th>
                  </tr>
                </thead>
                <tbody>
                  {client.sessions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{s.family_member_name || '—'}</td>
                      <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{fmtDateTime(s.started_at)}</td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{s.turn_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: '12px',
      padding: '1.25rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '1rem', fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-all', fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? '0.75rem' : 'inherit' }}>
        {value}
      </span>
    </div>
  )
}

function DangerBtn({ label, onClick, disabled, variant }: {
  label: string; onClick: () => void; disabled?: boolean; variant: 'warning' | 'danger'
}) {
  const styles = {
    warning: { background: '#fef3c7', color: '#92400e' },
    danger: { background: '#fee2e2', color: '#991b1b' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.5rem 1rem',
        border: 'none',
        borderRadius: '8px',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...styles[variant],
      }}
    >
      {label}
    </button>
  )
}
