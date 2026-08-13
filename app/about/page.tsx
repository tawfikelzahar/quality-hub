'use client'

import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'

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
  const { t } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const dark = theme === 'dark'

  // Body copy needs more contrast than c.muted (which is tuned for small
  // labels/captions elsewhere in the app, not paragraphs of reading text).
  // This sits between c.muted and c.text — readable without shouting.
  const bodyColor = dark ? 'rgba(226,232,240,0.82)' : 'rgba(30,41,59,0.82)'

  const sectionHeading: React.CSSProperties = {
    fontSize: 19,
    fontWeight: 800,
    color: c.text,
    margin: '0 0 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  }
  const headingBar: React.CSSProperties = {
    width: 4,
    height: 18,
    borderRadius: 2,
    background: c.accent,
    flexShrink: 0,
  }
  const paragraph: React.CSSProperties = {
    fontSize: 15,
    color: bodyColor,
    lineHeight: 1.85,
    margin: '0 0 16px',
  }

  const iconStyle = { width: 15, height: 15, flexShrink: 0 }

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_about" showGetPro={false} />

      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <div style={{ maxWidth: 720, width: '100%', marginTop: 20 }}>
          {/* ── Hero ── */}
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
              {t('about_kicker')}
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: c.text, margin: 0, lineHeight: 1.28, letterSpacing: -0.5 }}>
              {t('about_hero_title_1')}<br />{t('about_hero_title_2')}
            </h1>
          </div>

          {/* ── Origin story ── */}
          <section style={{ marginBottom: 40 }}>
            <p style={paragraph}>
              {t('about_origin_p1')}
            </p>
            <p style={{ ...paragraph, marginBottom: 0 }}>
              {t('about_origin_p2')}
            </p>
          </section>

          {/* ── Philosophy ── */}
          <section style={{ ...s.card, marginBottom: 28, padding: 28 }}>
            <h2 style={sectionHeading}>
              <span style={headingBar} />
              {t('about_philosophy_heading')}
            </h2>
            <p style={{ ...paragraph, marginBottom: 22 }}>
              {t('about_philosophy_p')}
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 8,
                paddingTop: 18,
                borderTop: `1px solid ${c.border}`,
              }}
            >
              {(['about_step_analyze', 'about_step_understand', 'about_step_decide', 'about_step_improve'] as const).map((stepKey, i) => (
                <div key={stepKey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: c.accent,
                      background: `${c.accent}14`,
                      border: `1px solid ${c.accent}30`,
                      borderRadius: 20,
                      padding: '6px 14px',
                    }}
                  >
                    {t(stepKey)}
                  </span>
                  {i < 3 && <span style={{ color: c.muted, fontSize: 14 }}>→</span>}
                </div>
              ))}
            </div>
          </section>

          {/* ── Direct, hands-on, accountable ── */}
          <section style={{ marginBottom: 44 }}>
            <h2 style={sectionHeading}>
              <span style={headingBar} />
              {t('about_direct_heading')}
            </h2>
            <p style={paragraph}>
              {t('about_direct_p1')}
            </p>
            <p style={{ ...paragraph, marginBottom: 0 }}>
              {t('about_direct_p2')}
            </p>
          </section>

          {/* ── Meet the Builder ── */}
          <section style={{ ...s.card, marginBottom: 40, padding: '36px 28px', textAlign: 'center' }}>
            <div
              style={{
                width: 116,
                height: 116,
                borderRadius: '50%',
                overflow: 'hidden',
                margin: '0 auto 18px',
                border: `3px solid ${c.accent}`,
                boxShadow: `0 0 0 6px ${c.accent}14`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tawfik-elzahar.jpg"
                alt="Tawfik Elzahar"
                width={116}
                height={116}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>

            <div style={{ fontSize: 19, fontWeight: 800, color: c.text, marginBottom: 2 }}>
              {t('about_builder_name')}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.accent, marginBottom: 20 }}>
              {t('about_builder_role')}
            </div>

            <p style={{ ...paragraph, maxWidth: 460, margin: '0 auto 24px', fontSize: 14 }}>
              {t('about_builder_cta')}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href={`mailto:${CONTACT.email}`}
                style={{ ...s.exportBtn, textDecoration: 'none', width: 'auto', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" />
                  <path d="m4 6 8 7 8-7" />
                </svg>
                {t('cta_email')}
              </a>
              <a
                href={CONTACT.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...s.exportBtn, textDecoration: 'none', width: 'auto', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.27 4.9L2 22l5.25-1.38A9.94 9.94 0 0 0 12.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm5.72 14.24c-.24.68-1.4 1.3-1.94 1.35-.5.05-1.02.24-3.4-.71-2.9-1.16-4.76-4.1-4.9-4.3-.14-.2-1.17-1.55-1.17-2.96 0-1.4.74-2.09 1-2.38.26-.28.57-.35.76-.35h.5c.17 0 .38-.02.6.46.24.55.8 1.94.87 2.08.07.14.12.31.02.5-.1.2-.15.3-.29.47-.14.16-.3.36-.43.48-.14.14-.3.28-.13.55.17.28.75 1.24 1.62 2.01 1.11 1 2.05 1.3 2.32 1.45.28.14.44.12.6-.07.17-.2.7-.82.9-1.1.19-.28.38-.24.63-.14.26.1 1.64.77 1.92.91.28.14.47.2.53.32.07.12.07.68-.17 1.36Z" />
                </svg>
                {t('cta_whatsapp')}
              </a>
              <a
                href={CONTACT.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...s.exportBtn, textDecoration: 'none', width: 'auto', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45Z" />
                </svg>
                {t('cta_linkedin')}
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
