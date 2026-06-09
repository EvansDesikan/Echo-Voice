import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import OnboardingLayout from '../../components/OnboardingLayout'
import { QUESTIONS, PAGES } from '../../data/questions'
import { submitQuestionnaire } from '../../api/client'
import { useLang } from '../../context/LanguageContext'

function quizStorageKey(clientId: string) { return `echo_quiz_${clientId}` }

export default function QuestionnairePage() {
  const navigate = useNavigate()
  const { T, lang } = useLang()
  const clientId = localStorage.getItem('echo_client_id') ?? ''

  // Restore saved progress from localStorage on first render
  const savedRaw = clientId ? localStorage.getItem(quizStorageKey(clientId)) : null
  const saved = savedRaw ? JSON.parse(savedRaw) : null

  const [answers, setAnswers] = useState<Record<string, number>>(saved?.answers ?? {})
  const [page, setPage] = useState<number>(saved?.page ?? 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Persist answers + page to localStorage on every change
  useEffect(() => {
    if (!clientId) return
    localStorage.setItem(quizStorageKey(clientId), JSON.stringify({ answers, page }))
  }, [answers, page, clientId])

  // Scroll to top AFTER React re-renders the new page content
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const currentQuestions = PAGES[page]
  const totalPages = PAGES.length
  const overallProgress = Math.round((Object.keys(answers).length / QUESTIONS.length) * 100)
  const pageComplete = currentQuestions.every((q) => answers[q.id] !== undefined)
  const isLastPage = page === totalPages - 1
  const allAnswered = QUESTIONS.every((q) => answers[q.id] !== undefined)

  function setAnswer(id: string, val: number) { setAnswers((p) => ({ ...p, [id]: val })) }

  function goNext() { if (page < totalPages - 1) setPage((p) => p + 1) }
  function goPrev() { if (page > 0) setPage((p) => p - 1) }

  async function handleSubmit() {
    if (!clientId) { navigate('/onboarding/consent'); return }
    setLoading(true); setError('')
    try {
      await submitQuestionnaire({ client_id: clientId, answers })
      localStorage.removeItem(quizStorageKey(clientId))
      navigate('/onboarding/phrases')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ein Fehler ist aufgetreten.')
    } finally { setLoading(false) }
  }

  return (
    <OnboardingLayout currentStep={2}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ marginBottom: 8 }}>{T.quiz_title}</h2>
        <p>{T.quiz_subtitle}</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {T.quiz_page} {page + 1} {T.quiz_of} {totalPages}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
            {overallProgress}{T.quiz_completed}
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
        {currentQuestions.map((q, idx) => {
          const globalIdx = page * 10 + idx + 1
          const questionText = lang === 'en' ? q.text_en ?? q.text : q.text
          return (
            <div key={q.id} className="card card--elevated">
              <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'flex-start' }}>
                <span style={{
                  background: answers[q.id] ? 'var(--primary)' : 'var(--bg-subtle)',
                  color: answers[q.id] ? '#fff' : 'var(--text-muted)',
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.72rem', fontWeight: 600, flexShrink: 0,
                  marginTop: 2, transition: 'all 200ms',
                }}>
                  {globalIdx}
                </span>
                <p style={{ margin: 0, fontSize: '0.975rem', color: 'var(--text)', lineHeight: 1.6 }}>
                  {questionText}
                </p>
              </div>
              <div className="likert">
                {[1, 2, 3, 4, 5].map((val) => (
                  <div key={val} className="likert__option">
                    <input type="radio" id={`${q.id}-${val}`} name={q.id} value={val} className="likert__input"
                      checked={answers[q.id] === val} onChange={() => setAnswer(q.id, val)} />
                    <label htmlFor={`${q.id}-${val}`} className="likert__label">{val}</label>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{T.quiz_scale_low}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{T.quiz_scale_high}</span>
              </div>
            </div>
          )
        })}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12 }}>
        {page > 0 && <button className="btn btn--ghost" onClick={goPrev}><ChevronLeft size={16} /> {T.quiz_btn_back}</button>}
        <div style={{ flex: 1 }} />
        {!isLastPage
          ? <button className="btn btn--primary" onClick={goNext} disabled={!pageComplete}>{T.quiz_btn_next} <ChevronRight size={16} /></button>
          : <button className="btn btn--primary btn--lg" onClick={handleSubmit} disabled={!allAnswered || loading}>{loading ? T.quiz_btn_loading : T.quiz_btn_submit}</button>
        }
      </div>
      {!pageComplete && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>{T.quiz_all_required}</p>}
    </OnboardingLayout>
  )
}
