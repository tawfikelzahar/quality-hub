'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

// ─────────────────────────────────────────────────────────────────────────
// Pricing — kept in line with what the code actually gates (Oct 2026):
//   • every analysis tool is free and needs no account, except Gage R&R
//     (components/GageRR.tsx renders LockedPage for non-Pro)
//   • CSV / PNG export needs a free account (lib/exportGate.ts goToLogin);
//     free PNGs keep the chart watermark (lib/watermarkHelpers.ts)
//   • PDF / Excel export, saved projects (MAX_SAVED_ANALYSES = 50 in
//     app/api/saved-analyses) and AI Insights (AI_DAILY_LIMIT = 10/day in
//     lib/ai/insight.ts, X̄-R page) are Pro
// Pro is not on sale yet (no checkout), so the Pro card has no buy button.
// Update this table whenever a gate changes.
// ─────────────────────────────────────────────────────────────────────────

interface Feature {
  labelKey: TKey
  free: boolean | TKey
  pro: boolean | TKey
}

const FEATURES: { sectionKey: TKey; items: Feature[] }[] = [
  {
    sectionKey: 'pricing_section_spc',
    items: [
      { labelKey: 'pricing_feat_imr', free: true, pro: true },
      { labelKey: 'pricing_feat_attribute', free: true, pro: true },
      { labelKey: 'pricing_feat_nelson', free: true, pro: true },
      { labelKey: 'pricing_feat_capability', free: true, pro: true },
      { labelKey: 'pricing_feat_ad', free: true, pro: true },
      { labelKey: 'pricing_feat_dist', free: true, pro: true },
    ],
  },
  {
    sectionKey: 'pricing_section_other',
    items: [
      { labelKey: 'pricing_feat_descriptive', free: true, pro: true },
      { labelKey: 'pricing_feat_pareto', free: true, pro: true },
      { labelKey: 'pricing_feat_dpmo', free: true, pro: true },
      { labelKey: 'pricing_feat_oee', free: true, pro: true },
      { labelKey: 'pricing_feat_aql', free: true, pro: true },
      { labelKey: 'pricing_feat_icmsf', free: true, pro: true },
      { labelKey: 'pricing_feat_stability', free: true, pro: true },
      { labelKey: 'pricing_feat_regression', free: true, pro: true },
      { labelKey: 'pricing_feat_doe', free: true, pro: true },
      { labelKey: 'pricing_feat_gagerr', free: false, pro: true },
    ],
  },
  {
    sectionKey: 'pricing_section_export',
    items: [
      { labelKey: 'pricing_feat_export_csv', free: 'pricing_val_watermark', pro: 'pricing_val_nowatermark' },
      { labelKey: 'pricing_feat_export_excel', free: false, pro: true },
      { labelKey: 'pricing_feat_save', free: false, pro: 'pricing_val_50projects' },
      { labelKey: 'pricing_feat_ai', free: false, pro: 'pricing_val_ai_limit' },
    ],
  },
]

function Check({ ok, t }: { ok: boolean | TKey; accent: string; muted: string; t: (k: TKey) => string }) {
  if (ok === false) return <span style={{ opacity: 0.35 }}>—</span>
  if (typeof ok === 'string') return <span>{t(ok)}</span>
  return <span>✓</span>
}

export default function PricingPage() {
  const [theme, setTheme] = usePersistedTheme()
  const { t } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  const [loggedIn, setLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setLoggedIn(!!data.user)
      setCheckingAuth(false)
    })
  }, [])

  const freeCtaHref = loggedIn ? '/dashboard' : '/login?next=/dashboard'
  
  const planCard = (
    opts: {
      name: string
      price: string
      tagline: string
      bullets: string[]
      cta: string
      href: string | null
      highlight?: boolean
    }
  ) => (
    <div
      style={{
        ...s.card,
        flex: 1,
        minWidth: 280,
        border: opts.highlight ? `2px solid ${c.gold}` : s.card.border,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {opts.highlight && (
        <span
          style={{
            position: 'absolute',
            top: -12,
            left: 20,
            background: c.gold,
            color: c.onGold,
            fontSize: 11,
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 20,
          }}
        >
          {t('pricing_recommended')}
        </span>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginTop: opts.highlight ? 8 : 0 }}>
        {opts.name}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: c.text, margin: '8px 0 2px' }}>
        {opts.price}
      </div>
      <div style={{ fontSize: 12, color: c.muted, marginBottom: 18 }}>{opts.tagline}</div>
      <ul style={{ margin: '0 0 20px', paddingLeft: 18, fontSize: 13, color: c.text, lineHeight: 2, flex: 1 }}>
        {opts.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {opts.href === null ? (
        <div aria-disabled="true" style={{ ...s.exportBtn, width: '100%', opacity: 0.55, cursor: 'default' }}>{opts.cta}</div>
      ) : checkingAuth ? (
        <div style={{ ...s.exportBtn, opacity: 0.4, width: '100%' }}>{t('pricing_loading')}</div>
      ) : (
        <Link
          href={opts.href}
          style={{
            ...s.exportBtn,
            width: '100%',
            textDecoration: 'none',
            background: opts.highlight ? c.accent : s.exportBtn.background,
            color: opts.highlight ? 'var(--qh-onAccent)' : c.text,
          }}
        >
          {opts.cta}
        </Link>
      )}
    </div>
  )

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_pricing" showGetPro={false} />

      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <div style={{ maxWidth: 880, width: '100%', textAlign: 'center', marginTop: 20, marginBottom: 8 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: c.text, margin: '0 0 10px' }}>
            {t('pricing_hero_title')}
          </h1>
          <p style={{ fontSize: 14, color: c.muted, margin: 0 }}>
            {t('pricing_hero_sub')}
          </p>
          <Link
            href="/sample-reports"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 16,
              fontSize: 13.5,
              fontWeight: 700,
              color: c.accent,
              textDecoration: 'none',
              border: `1px solid ${c.accent}40`,
              background: `${c.accent}12`,
              borderRadius: 20,
              padding: '8px 18px',
            }}
          >
            📄 {t('pricing_see_samples_link')} →
          </Link>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', maxWidth: 880, width: '100%', marginTop: 28 }}>
          {planCard({
            name: t('pricing_free_name'),
            price: t('pricing_free_price'),
            tagline: t('pricing_free_tagline'),
            bullets: [
              t('pricing_free_bullet_1'),
              t('pricing_free_bullet_2'),
              t('pricing_free_bullet_3'),
              t('pricing_free_bullet_4'),
              t('pricing_free_bullet_5'),
            ],
            cta: loggedIn ? t('pricing_free_cta_dashboard') : t('pricing_free_cta_start'),
            href: freeCtaHref,
          })}
          {planCard({
            name: t('pricing_pro_name'),
            price: t('pricing_price_label'),
            tagline: t('pricing_pro_tagline'),
            bullets: [
              t('pricing_pro_bullet_1'),
              t('pricing_pro_bullet_2'),
              t('pricing_pro_bullet_3'),
              t('pricing_pro_bullet_4'),
              t('pricing_pro_bullet_5'),
            ],
            cta: t('pricing_pro_cta'),
            href: null,
            highlight: true,
          })}
        </div>

        {/* Feature comparison table */}
        <div style={{ maxWidth: 880, width: '100%', marginTop: 40 }}>
          <div style={s.sectionTitle}>{t('pricing_table_title')}</div>
          <div style={s.chartWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, textAlign: 'start' }}>{t('pricing_col_feature')}</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>{t('pricing_col_free')}</th>
                  <th style={{ ...s.th, textAlign: 'center', color: c.gold }}>{t('pricing_col_pro')}</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((group) => (
                  <Fragment key={group.sectionKey}>
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          ...s.td,
                          textAlign: 'start',
                          fontSize: 11,
                          fontWeight: 700,
                          color: c.muted,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          background: c.surface2,
                          borderBottom: `1px solid ${c.border}`,
                        }}
                      >
                        {t(group.sectionKey)}
                      </td>
                    </tr>
                    {group.items.map((f) => (
                      <tr key={f.labelKey}>
                        <td style={{ ...s.td, textAlign: 'start' }}>{t(f.labelKey)}</td>
                        <td style={{ ...s.td, textAlign: 'center', color: c.muted }}>
                          <Check ok={f.free} accent={c.accent} muted={c.muted} t={t} />
                        </td>
                        <td style={{ ...s.td, textAlign: 'center', color: c.gold, fontWeight: 600 }}>
                          <Check ok={f.pro} accent={c.accent} muted={c.muted} t={t} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ fontSize: 12, color: c.muted, marginTop: 32, marginBottom: 20 }}>
          {t('pricing_footer_prefix')}{' '}
          <Link href="/contact" style={{ color: c.accent, textDecoration: 'none', fontWeight: 600 }}>
            {t('pricing_footer_link')}
          </Link>{' '}
          {t('pricing_footer_suffix')}
        </div>
      </main>
    </div>
  )
}
