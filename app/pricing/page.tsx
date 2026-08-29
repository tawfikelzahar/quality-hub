'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

// ─────────────────────────────────────────────────────────────────────────
// Pricing is intentionally static for now (Phase 3 of the subscription
// rollout plan). No real checkout yet — that's Phase 6 (Lemon Squeezy).
// The Pro CTA sends the person to /account, where the real
// "Upgrade to Pro — Coming Soon" stub already lives.
//
// PRICE_LABEL is translated via the pricing_price_label i18n key now.
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
      { labelKey: 'pricing_feat_capability', free: true, pro: true },
      { labelKey: 'pricing_feat_attribute', free: false, pro: true },
      { labelKey: 'pricing_feat_nelson', free: false, pro: true },
      { labelKey: 'pricing_feat_ad', free: false, pro: true },
      { labelKey: 'pricing_feat_dist', free: false, pro: true },
    ],
  },
  {
    sectionKey: 'pricing_section_other',
    items: [
      { labelKey: 'pricing_feat_pareto', free: true, pro: true },
      { labelKey: 'pricing_feat_dpmo', free: true, pro: true },
      { labelKey: 'pricing_feat_oee', free: true, pro: true },
      { labelKey: 'pricing_feat_gagerr', free: false, pro: true },
      { labelKey: 'pricing_feat_stability', free: false, pro: true },
      { labelKey: 'pricing_feat_aql', free: false, pro: true },
    ],
  },
  {
    sectionKey: 'pricing_section_export',
    items: [
      { labelKey: 'pricing_feat_export_csv', free: 'pricing_val_watermark', pro: 'pricing_val_nowatermark' },
      { labelKey: 'pricing_feat_export_excel', free: false, pro: true },
      { labelKey: 'pricing_feat_save', free: false, pro: 'pricing_val_50projects' },
      { labelKey: 'pricing_feat_dashboard', free: false, pro: true },
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
  const proCtaHref = loggedIn ? '/account' : '/login?next=/account'

  const planCard = (
    opts: {
      name: string
      price: string
      tagline: string
      bullets: string[]
      cta: string
      href: string
      highlight?: boolean
    }
  ) => (
    <div
      style={{
        ...s.card,
        flex: 1,
        minWidth: 280,
        border: opts.highlight ? `2px solid ${c.accent}` : s.card.border,
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
            background: c.accent,
            color: '#060d1a',
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
      {checkingAuth ? (
        <div style={{ ...s.exportBtn, opacity: 0.4, width: '100%' }}>{t('pricing_loading')}</div>
      ) : (
        <Link
          href={opts.href}
          style={{
            ...s.exportBtn,
            width: '100%',
            textDecoration: 'none',
            background: opts.highlight ? c.accent : s.exportBtn.background,
            color: opts.highlight ? '#060d1a' : c.text,
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
            href: proCtaHref,
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
                  <th style={s.th}>{t('pricing_col_feature')}</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>{t('pricing_col_free')}</th>
                  <th style={{ ...s.th, textAlign: 'center', color: c.accent }}>{t('pricing_col_pro')}</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((group) => (
                  <>
                    <tr key={group.sectionKey}>
                      <td
                        colSpan={3}
                        style={{
                          ...s.td,
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
                        <td style={s.td}>{t(f.labelKey)}</td>
                        <td style={{ ...s.td, textAlign: 'center', color: c.muted }}>
                          <Check ok={f.free} accent={c.accent} muted={c.muted} t={t} />
                        </td>
                        <td style={{ ...s.td, textAlign: 'center', color: c.accent, fontWeight: 600 }}>
                          <Check ok={f.pro} accent={c.accent} muted={c.muted} t={t} />
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ fontSize: 12, color: c.muted, marginTop: 32, marginBottom: 20 }}>
          {t('pricing_footer_prefix')}{' '}
          <Link href="/account" style={{ color: c.accent, textDecoration: 'none', fontWeight: 600 }}>
            {t('pricing_footer_link')}
          </Link>{' '}
          {t('pricing_footer_suffix')}
        </div>
      </main>
    </div>
  )
}
