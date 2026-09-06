'use client'

import Link from 'next/link'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

// ─────────────────────────────────────────────────────────────────────────
// /guide — platform-level "how to use" page + full tool directory.
//
// This is intentionally NOT a duplicate of /about. /about tells the story
// of who built Quality Hub and why (bio, photo, philosophy). /guide is
// purely functional: how the platform works + where every tool lives.
// The only link between them is a single line at the bottom pointing to
// /about — no repeated bio copy, no repeated photo (avoids thin/duplicate
// content for SEO and keeps each page's job singular).
//
// Tool list mirrows app/page.tsx's TOOL_SECTIONS (same hrefs/titles/icons)
// so this directory never drifts out of sync with the homepage tool grid.
// If you add a tool to the homepage, add it here too.
// ─────────────────────────────────────────────────────────────────────────

interface GuideToolData {
  href: string | null
  icon: string
  titleKey: TKey
  descKey: TKey
  live: boolean
}

interface GuideSectionData {
  id: string
  labelKey: TKey
  tools: GuideToolData[]
}

const GUIDE_SECTIONS: GuideSectionData[] = [
  {
    id: 'section-stability',
    labelKey: 'section_stability_label',
    tools: [
      { href: '/spc', icon: '📊', titleKey: 'spc_title', descKey: 'spc_desc', live: true },
      { href: '/imr-chart', icon: '📊', titleKey: 'imr_title', descKey: 'imr_desc', live: true },
      { href: '/xbar-r-chart', icon: '📈', titleKey: 'xbar_r_title', descKey: 'xbar_r_desc', live: true },
      { href: '/xbar-s-chart', icon: '📈', titleKey: 'xbar_s_title', descKey: 'xbar_s_desc', live: true },
    ],
  },
  {
    id: 'section-msa',
    labelKey: 'section_msa_label',
    tools: [
      { href: '/gage-rr', icon: '🎯', titleKey: 'gagerr_title', descKey: 'gagerr_desc', live: true },
    ],
  },
  {
    id: 'section-regression',
    labelKey: 'section_regression_label',
    tools: [
      { href: '/regression', icon: '📈', titleKey: 'regression_title', descKey: 'regression_desc', live: true },
      { href: '/multiregression', icon: '📉', titleKey: 'multiregression_title', descKey: 'multiregression_desc', live: true },
    ],
  },
  {
    id: 'section-doe',
    labelKey: 'section_doe_label',
    tools: [
      { href: '/doe', icon: '🧪', titleKey: 'doe_title', descKey: 'doe_desc', live: true },
    ],
  },
  {
    id: 'section-sampling',
    labelKey: 'section_sampling_label',
    tools: [
      { href: '/aql', icon: '📋', titleKey: 'aql_title', descKey: 'aql_desc', live: true },
      { href: '/icmsf', icon: '🧫', titleKey: 'icmsf_title', descKey: 'icmsf_desc', live: true },
    ],
  },
  {
    id: 'section-quality',
    labelKey: 'section_quality_label',
    tools: [
      { href: '/pareto', icon: '📈', titleKey: 'pareto_title', descKey: 'pareto_desc', live: true },
      { href: '/dpmo', icon: '🎯', titleKey: 'dpmo_title', descKey: 'dpmo_desc', live: true },
      { href: '/oee', icon: '⚙️', titleKey: 'oee_title', descKey: 'oee_desc', live: true },
      { href: null, icon: '⚠️', titleKey: 'fmea_title', descKey: 'fmea_desc', live: false },
    ],
  },
  {
    id: 'section-descriptive',
    labelKey: 'section_descriptive_label',
    tools: [
      { href: '/descriptive', icon: '📐', titleKey: 'descriptive_title', descKey: 'descriptive_desc', live: true },
    ],
  },
  {
    id: 'section-reliability',
    labelKey: 'section_reliability_label',
    tools: [
      { href: '/stability', icon: '🧪', titleKey: 'stability_title', descKey: 'stability_desc', live: true },
    ],
  },
]

export default function GuidePage() {
  const [theme, setTheme] = usePersistedTheme()
  const { t } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const dark = theme === 'dark'

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

  const STEP_KEYS: { titleKey: TKey; descKey: TKey }[] = [
    { titleKey: 'guide_step_1_title', descKey: 'guide_step_1_desc' },
    { titleKey: 'guide_step_2_title', descKey: 'guide_step_2_desc' },
    { titleKey: 'guide_step_3_title', descKey: 'guide_step_3_desc' },
    { titleKey: 'guide_step_4_title', descKey: 'guide_step_4_desc' },
  ]

  const FAQ_KEYS: { q: TKey; a: TKey }[] = [
    { q: 'guide_faq_1_q', a: 'guide_faq_1_a' },
    { q: 'guide_faq_2_q', a: 'guide_faq_2_a' },
    { q: 'guide_faq_3_q', a: 'guide_faq_3_a' },
  ]

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_guide" showGetPro={false} />

      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <div style={{ maxWidth: 860, width: '100%', marginTop: 20 }}>
          {/* ── Hero ── */}
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
              {t('guide_kicker')}
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: c.text, margin: 0, lineHeight: 1.28, letterSpacing: -0.5 }}>
              {t('guide_hero_title_1')}<br />{t('guide_hero_title_2')}
            </h1>
            <p style={{ ...paragraph, maxWidth: 560, margin: '18px auto 0' }}>
              {t('guide_hero_sub')}
            </p>
          </div>

          {/* ── 4-step how it works ── */}
          <section style={{ ...s.card, marginBottom: 40, padding: 28 }}>
            <h2 style={sectionHeading}>
              <span style={headingBar} />
              {t('guide_steps_heading')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              {STEP_KEYS.map((step, i) => (
                <div key={step.titleKey}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: `${c.accent}14`,
                      border: `1px solid ${c.accent}30`,
                      color: c.accent,
                      fontWeight: 800,
                      fontSize: 13,
                      marginBottom: 10,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginBottom: 6 }}>
                    {t(step.titleKey)}
                  </div>
                  <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.7 }}>
                    {t(step.descKey)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Tool directory ── */}
          <section style={{ marginBottom: 44 }}>
            <h2 style={sectionHeading}>
              <span style={headingBar} />
              {t('guide_tools_heading')}
            </h2>
            <p style={{ ...paragraph, marginBottom: 24 }}>{t('guide_tools_sub')}</p>

            {GUIDE_SECTIONS.map((section) => (
              <div key={section.id} style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                  {t(section.labelKey)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                  {section.tools.map((tool) => {
                    const inner = (
                      <>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{tool.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 2 }}>
                            {t(tool.titleKey)}
                          </div>
                          <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.5 }}>
                            {t(tool.descKey)}
                          </div>
                        </div>
                      </>
                    )
                    return tool.live && tool.href ? (
                      <Link
                        key={tool.titleKey}
                        href={tool.href}
                        style={{ ...s.card, display: 'flex', gap: 12, alignItems: 'flex-start', textDecoration: 'none', color: 'inherit' }}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div
                        key={tool.titleKey}
                        style={{ ...s.card, display: 'flex', gap: 12, alignItems: 'flex-start', opacity: 0.6 }}
                      >
                        {inner}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>

          {/* ── FAQ ── */}
          <section style={{ ...s.card, marginBottom: 40, padding: 28 }}>
            <h2 style={sectionHeading}>
              <span style={headingBar} />
              {t('guide_faq_heading')}
            </h2>
            {FAQ_KEYS.map((faq, i) => (
              <div
                key={faq.q}
                style={{
                  paddingBottom: 16,
                  marginBottom: i < FAQ_KEYS.length - 1 ? 16 : 0,
                  borderBottom: i < FAQ_KEYS.length - 1 ? `1px solid ${c.border}` : 'none',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginBottom: 6 }}>
                  {t(faq.q)}
                </div>
                <div style={{ fontSize: 14, color: bodyColor, lineHeight: 1.75 }}>
                  {t(faq.a)}
                </div>
              </div>
            ))}
          </section>

          {/* ── Single line linking to /about — no repeated bio/photo ── */}
          <p style={{ textAlign: 'center', fontSize: 13, color: c.muted, marginBottom: 20 }}>
            {t('guide_footer_note')}{' '}
            <Link href="/about" style={{ color: c.accent, fontWeight: 600, textDecoration: 'none' }}>
              {t('about_builder_name')}
            </Link>
            {t('guide_footer_note_end')}
          </p>
        </div>
      </main>
    </div>
  )
}
