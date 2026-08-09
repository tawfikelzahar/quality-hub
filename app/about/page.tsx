'use client'

import Link from 'next/link'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'

// ─────────────────────────────────────────────────────────────────────────
// Static content page — no data fetching, no auth gating. Copy lives here
// as plain strings so it's easy to tweak later without touching layout.
//
// Contact channels are shared with /contact — if you change the email,
// WhatsApp number, or LinkedIn URL, update both files.
// ─────────────────────────────────────────────────────────────────────────
const CONTACT = {
  email: 'tawfik.elzahar1@gmail.com',
  whatsapp: 'https://wa.me/201224491539',
  linkedin: 'https://www.linkedin.com/in/tawfikelzahar',
}

export default function AboutPage() {
  const [theme, setTheme] = usePersistedTheme()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  const sectionHeading: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    color: c.text,
    margin: '0 0 12px',
  }
  const paragraph: React.CSSProperties = {
    fontSize: 14,
    color: c.muted,
    lineHeight: 1.8,
    margin: '0 0 14px',
  }

  return (
    <div style={s.page}>
      <nav className="qh-nav" style={s.nav}>
        <div className="qh-nav-left" style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span className="qh-breadcrumb-sep" style={s.separator}>/</span>
          <span className="qh-breadcrumb" style={s.breadcrumb}>About</span>
        </div>
        <div className="qh-nav-right" style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <AuthStatus />
        </div>
      </nav>

      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <div style={{ maxWidth: 720, width: '100%', marginTop: 20 }}>
          {/* ── Hero ── */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              About Quality Hub
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: c.text, margin: 0, lineHeight: 1.3 }}>
              Built by a Quality Engineer,<br />for Quality Engineers.
            </h1>
          </div>

          {/* ── Origin story ── */}
          <section style={{ marginBottom: 36 }}>
            <p style={paragraph}>
              Quality Hub started with a simple frustration: quality engineers shouldn&apos;t need five
              different tools, a stack of spreadsheets, and an expensive software license just to run
              an SPC chart or calculate Cpk.
            </p>
            <p style={paragraph}>
              After more than 10 years working in manufacturing, quality engineering, and continuous
              improvement, I built the platform I wished existed — one place for SPC, Process
              Capability, Pareto Analysis, AQL Sampling, Gage R&amp;R (MSA), and Stability Studies,
              built to the standards engineers actually work against: ISO 2859-1, AIAG, and ICH Q1E.
            </p>
          </section>

          {/* ── Philosophy ── */}
          <section style={{ ...s.card, marginBottom: 24 }}>
            <h2 style={sectionHeading}>Our Philosophy</h2>
            <p style={paragraph}>
              Good quality engineering starts with good evidence. Data should help you understand
              variation. Analysis should support real decisions. And better decisions should lead to
              better processes.
            </p>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: c.accent,
                textAlign: 'center',
                padding: '14px 0 4px',
                letterSpacing: 0.3,
              }}
            >
              Analyze → Understand → Decide → Improve
            </div>
          </section>

          {/* ── Direct, hands-on, accountable ── */}
          <section style={{ marginBottom: 40 }}>
            <h2 style={sectionHeading}>Direct, hands-on, and accountable</h2>
            <p style={paragraph}>
              Every tool on Quality Hub is built, tested, and maintained by me — actively used and
              refined based on real quality engineering work, not handed off to a support team that
              doesn&apos;t understand the field.
            </p>
            <p style={paragraph}>
              When you reach out, you&apos;re talking directly to the person building the platform.
              Feedback turns into features fast, because there&apos;s no layer between your request
              and the person who can act on it.
            </p>
          </section>

          {/* ── Meet the Builder ── */}
          <section style={{ ...s.card, marginBottom: 40, textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#0fd4c8,#00a896)',
                color: '#060d1a',
                fontWeight: 800,
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              TE
            </div>
            <h2 style={{ ...sectionHeading, textAlign: 'center' }}>Meet the Builder</h2>
            <p style={{ ...paragraph, maxWidth: 480, margin: '0 auto 20px' }}>
              I&apos;m Tawfik Elzahar, the Quality Engineer building and maintaining Quality Hub. If
              you have questions, feedback, or a feature request, I&apos;d genuinely like to hear
              from you.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={`mailto:${CONTACT.email}`} style={{ ...s.exportBtn, textDecoration: 'none', width: 'auto', padding: '9px 18px' }}>
                ✉️ Email
              </a>
              <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" style={{ ...s.exportBtn, textDecoration: 'none', width: 'auto', padding: '9px 18px' }}>
                💬 WhatsApp
              </a>
              <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" style={{ ...s.exportBtn, textDecoration: 'none', width: 'auto', padding: '9px 18px' }}>
                🔗 LinkedIn
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
