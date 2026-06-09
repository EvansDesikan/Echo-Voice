// ─── Demo mode ───────────────────────────────────────────────────────────────
// On Vercel (production build) demo mode is always on — no backend is deployed.
// Also activated via: ?demo=true URL param, localStorage flag, or VITE_DEMO_MODE env var.
export const DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  new URLSearchParams(location.search).get('demo') === 'true' ||
  localStorage.getItem('echo_demo_mode') === 'true'

if (DEMO_MODE) {
  localStorage.setItem('echo_demo_mode', 'true')
  localStorage.setItem('echo_client_id', 'demo-client-00000000-0000-0000-0000-000000000001')
  localStorage.setItem('echo_client_name', 'Maria Müller')
  localStorage.setItem('echo_session_id', 'demo-session-00000000-0000-0000-0000-000000000002')
  localStorage.setItem('echo_persona_name', 'Maria Müller')
}

function delay(ms = 600) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const BASE = '/api'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  client_id: string
  client_name: string
  onboarding_complete: boolean
  has_voice_clone: boolean
  has_personality: boolean
  has_phrases: boolean
  voice_recording_count: number
}

export interface ExistingRecording {
  index: number
  object_key: string
  duration_seconds: number
  recording_type: 'scripted' | 'spontaneous'
  label: string
  uploaded_at: string
  playback_url: string
}

export async function getVoiceRecordings(clientId: string): Promise<{ recordings: ExistingRecording[]; total_duration: number }> {
  if (DEMO_MODE) {
    await delay(300)
    return { recordings: [], total_duration: 0 }
  }
  const res = await fetch(`${BASE}/onboard/voice-recordings/${clientId}`)
  if (!res.ok) throw new Error('Failed to fetch recordings')
  return res.json()
}

export async function login(email: string): Promise<LoginResponse> {
  if (DEMO_MODE) {
    await delay()
    return {
      client_id: 'demo-client-00000000-0000-0000-0000-000000000001',
      client_name: 'Maria Müller',
      onboarding_complete: true,
      has_voice_clone: true,
      has_personality: true,
      has_phrases: true,
      voice_recording_count: 6,
    }
  }
  return post('/auth/login', { email })
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

export interface ConsentResponse {
  client_id: string
  message: string
}

export async function registerConsent(data: {
  client_name: string
  email: string
  language: string
  consented: boolean
}): Promise<ConsentResponse> {
  if (DEMO_MODE) {
    await delay()
    const id = 'demo-client-00000000-0000-0000-0000-000000000001'
    localStorage.setItem('echo_client_id', id)
    localStorage.setItem('echo_client_name', data.client_name || 'Maria Müller')
    return { client_id: id, message: 'Demo-Einwilligung erteilt.' }
  }
  return post('/onboard/consent', data)
}

export async function submitQuestionnaire(data: {
  client_id: string
  answers: Record<string, number>
}): Promise<{ ocean_scores: Record<string, number>; behavioral_tags: string[] }> {
  if (DEMO_MODE) {
    await delay()
    return {
      ocean_scores: { O: 0.72, C: 0.61, E: 0.80, A: 0.75, N: 0.28 },
      behavioral_tags: ['uses_humour_often', 'warm_and_caring_tone', 'verbally_affectionate'],
    }
  }
  return post('/onboard/questionnaire', data)
}

export async function submitPhrases(data: {
  client_id: string
  phrases: string[]
}): Promise<{ status: string; phrase_count: number }> {
  if (DEMO_MODE) {
    await delay()
    return { status: 'ok', phrase_count: data.phrases.length }
  }
  return post('/onboard/phrases', data)
}

export async function submitMemories(data: {
  client_id: string
  memories: { text: string; source: string; memory_type: string }[]
}): Promise<{ status: string; memories_added: number }> {
  if (DEMO_MODE) {
    await delay()
    return { status: 'ok', memories_added: data.memories.length }
  }
  return post('/onboard/memories', data)
}

export async function buildPersonality(clientId: string): Promise<{ status: string }> {
  if (DEMO_MODE) {
    await delay(900)
    return { status: 'ok' }
  }
  return post(`/onboard/build-personality?client_id=${clientId}`, {})
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface SessionResponse {
  session_id: string
  client_name: string
  language: string
}

export async function startSession(data: {
  client_id: string
  family_member_name?: string
}): Promise<SessionResponse> {
  if (DEMO_MODE) {
    await delay()
    return {
      session_id: 'demo-session-00000000-0000-0000-0000-000000000002',
      client_name: localStorage.getItem('echo_persona_name') || 'Maria Müller',
      language: 'de',
    }
  }
  return post('/session/start', data)
}

export async function startSessionByEmail(data: {
  email: string
  family_member_name?: string
}): Promise<SessionResponse> {
  if (DEMO_MODE) {
    await delay()
    return {
      session_id: 'demo-session-00000000-0000-0000-0000-000000000002',
      client_name: localStorage.getItem('echo_persona_name') || 'Maria Müller',
      language: 'de',
    }
  }
  return post('/session/start-by-email', data)
}

const DEMO_RESPONSES = [
  'Schön, dass du dich meldest, mein Schatz. Wie geht es dir heute?',
  'Ich denke oft an uns — weißt du noch, damals auf Rügen? Das waren wirklich wunderschöne Tage.',
  'Mach dir keine Sorgen. Du schaffst das. Ich war immer stolz auf dich, und das werde ich immer sein.',
  'Na, wie läuft\'s? Erzähl mir — ich höre dir zu.',
  'Das klingt schwer. Ich wünschte, ich könnte einfach da sitzen und deine Hand halten.',
  'Ich liebe dich. Das weißt du, oder? Das hat sich nie geändert.',
]
let _demoResponseIdx = 0

export async function textChat(data: {
  session_id: string
  message: string
}): Promise<{ response: string }> {
  if (DEMO_MODE) {
    await delay(1200)
    const response = DEMO_RESPONSES[_demoResponseIdx % DEMO_RESPONSES.length]
    _demoResponseIdx++
    return { response }
  }
  return post('/session/text-chat', data)
}

export async function uploadVoiceRecording(
  clientId: string,
  audioBlob: Blob,
  recordingType: 'scripted' | 'spontaneous',
  index: number,
  durationSeconds: number = 0,
  label: string = '',
): Promise<{ object_key: string; duration_seconds: number }> {
  if (DEMO_MODE) {
    await delay(400)
    return { object_key: `demo/${clientId}/${recordingType}/${index}.webm`, duration_seconds: durationSeconds || 30 }
  }
  const form = new FormData()
  form.append('client_id', clientId)
  form.append('recording_type', recordingType)
  form.append('index', String(index))
  form.append('duration_seconds', String(durationSeconds))
  form.append('label', label)
  form.append('audio', audioBlob, `recording_${index}.webm`)
  const res = await fetch(`${BASE}/onboard/voice-upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

export async function createVoiceClone(clientId: string): Promise<{ voice_id: string }> {
  if (DEMO_MODE) {
    await delay(1500)
    return { voice_id: 'demo-voice-id-00000000' }
  }
  return post(`/onboard/create-voice-clone?client_id=${clientId}`, {})
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const ADMIN_KEY_STORAGE = 'echo_admin_key'

function adminHeaders(): HeadersInit {
  const key = sessionStorage.getItem(ADMIN_KEY_STORAGE) || ''
  return { 'Content-Type': 'application/json', 'X-Admin-Key': key }
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: adminHeaders() })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

async function adminDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: adminHeaders() })
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export interface AdminStats {
  total_clients: number
  total_clones: number
  total_complete: number
  total_recordings: number
  total_duration_seconds: number
  avg_duration_per_client: number
}

export interface AdminClientRow {
  id: string
  name: string
  email: string
  language: string
  onboarding_complete: boolean
  has_voice_clone: boolean
  has_personality: boolean
  has_phrases: boolean
  phrase_count: number
  recording_count: number
  total_duration_seconds: number
  created_at: string
}

export interface AdminClientDetail extends AdminClientRow {
  consent_given: boolean
  consent_timestamp: string | null
  elevenlabs_voice_id: string | null
  phrase_bank: string[]
  ocean_scores: Record<string, number> | null
  behavioral_tags: string[] | null
  recordings: {
    id: string
    label: string
    recording_type: string
    duration_seconds: number
    uploaded_at: string
  }[]
  sessions: {
    id: string
    family_member_name: string | null
    started_at: string
    ended_at: string | null
    turn_count: number
  }[]
}

export const adminApi = {
  getStats: () => adminGet<AdminStats>('/admin/stats'),
  listClients: () => adminGet<AdminClientRow[]>('/admin/clients'),
  getClient: (id: string) => adminGet<AdminClientDetail>(`/admin/clients/${id}`),
  deleteVoiceClone: (id: string) => adminDelete<{ status: string }>(`/admin/clients/${id}/voice-clone`),
  deleteRecordings: (id: string) => adminDelete<{ deleted_count: number }>(`/admin/clients/${id}/recordings`),
  deleteClient: (id: string) => adminDelete<{ status: string; name: string }>(`/admin/clients/${id}`),
}

export async function endSession(sessionId: string): Promise<void> {
  if (DEMO_MODE) { await delay(200); return }
  await fetch(`${BASE}/session/${sessionId}`, { method: 'DELETE' })
}

// ─── WebSocket voice session ──────────────────────────────────────────────────

export function openVoiceSocket(_sessionId: string): WebSocket {
  if (DEMO_MODE) {
    // Return a stub WebSocket that never errors — voice mode just won't produce audio
    return new WebSocket(`ws://${location.host}/demo-noop`)
  }
  const apiUrl = import.meta.env.VITE_API_URL || `${location.protocol}//${location.host}`
  const proto = apiUrl.startsWith('https') ? 'wss' : 'ws'
  const wsBase = apiUrl.replace(/^https?/, proto)
  return new WebSocket(`${wsBase}/session/voice/${_sessionId}`)
}
