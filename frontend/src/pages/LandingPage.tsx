import { Link } from 'react-router-dom'
import { Mic, Brain, Heart, Shield } from 'lucide-react'
import { useLang } from '../context/LanguageContext'

export default function LandingPage() {
  const { T } = useLang()

  return (
    <main>
      <section className="section">
        <div className="container">
          <div className="hero">
            <span className="hero__eyebrow">{T.land_eyebrow}</span>
            <h1 className="hero__title">{T.land_headline}</h1>
            <p className="hero__subtitle">{T.land_subtitle}</p>
            <div className="hero__cta">
              <Link to="/onboarding/consent" className="btn btn--primary btn--lg">{T.land_cta_primary}</Link>
              <Link to="/login" className="btn btn--secondary btn--lg">{T.land_cta_login}</Link>
              <Link to="/family" className="btn btn--ghost btn--lg">{T.land_cta_family}</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--gray">
        <div className="container">
          <div className="section__header">
            <h2>{T.land_how_title}</h2>
            <p className="section__subtitle">{T.land_how_subtitle}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {[
              { num: '01', title: T.land_step1_title, desc: T.land_step1_desc },
              { num: '02', title: T.land_step2_title, desc: T.land_step2_desc },
              { num: '03', title: T.land_step3_title, desc: T.land_step3_desc },
              { num: '04', title: T.land_step4_title, desc: T.land_step4_desc },
            ].map((step) => (
              <div key={step.num} className="card">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--primary)', opacity: 0.4, marginBottom: 12, lineHeight: 1 }}>{step.num}</div>
                <h4 style={{ marginBottom: 8, fontFamily: 'var(--font-display)' }}>{step.title}</h4>
                <p style={{ fontSize: '0.875rem' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__header">
            <h2>{T.land_feat_title}</h2>
          </div>
          <div className="feature-grid">
            {[
              { icon: <Mic size={20} />, title: T.land_feat1_title, desc: T.land_feat1_desc },
              { icon: <Brain size={20} />, title: T.land_feat2_title, desc: T.land_feat2_desc },
              { icon: <Heart size={20} />, title: T.land_feat3_title, desc: T.land_feat3_desc },
              { icon: <Shield size={20} />, title: T.land_feat4_title, desc: T.land_feat4_desc },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-card__icon">{f.icon}</div>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--gray">
        <div className="container text-center">
          <h2 style={{ marginBottom: 16 }}>{T.land_cta2_title}</h2>
          <p style={{ marginBottom: 32, maxWidth: 480, margin: '0 auto 32px' }}>{T.land_cta2_sub}</p>
          <Link to="/onboarding/consent" className="btn btn--primary btn--lg">{T.land_cta2_btn}</Link>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <p className="footer__text">{T.land_footer} · <a href="https://danach.de" target="_blank" rel="noopener noreferrer">danach.de</a></p>
          <p className="footer__text" style={{ marginTop: 8 }}>{T.land_footer2}</p>
        </div>
      </footer>
    </main>
  )
}
