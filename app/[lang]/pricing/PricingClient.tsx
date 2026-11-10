'use client'

import { Fragment, useState } from 'react'
import Link from '@/components/LocaleLink'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'
import { useAuthState } from '@/lib/authState'
import { FOUNDING, PRICES, formatPrice, savingPercent, type PeriodId, type Region } from '@/lib/pricing'

// ─────────────────────────────────────────────────────────────────────────
// Pricing — kept in line with what the code actually gates (Oct 2026):
//   • every tool runs free with no account and shows its main results and
//     accuracy warnings; Gage R&R runs free on its sample study only
//   • Pro readings (1 Nov 2026 split): Gage on own data, regression
//     diagnostics, DOE significance, stability claim, ICMSF risk, OEE card
//     (components/GageRR.tsx renders LockedPage for non-Pro)
//   • CSV / PNG export needs a free account (lib/exportGate.ts goToLogin);
//     free PNGs keep the chart watermark (lib/watermarkHelpers.ts)
//   • PDF / Excel export, saved projects (MAX_SAVED_ANALYSES = 50 in
//     app/api/saved-analyses) and AI Insights (AI_DAILY_LIMIT = 10/day in
//     lib/ai/insight.ts, X̄-R page) are Pro
// Prices come from lib/pricing.ts. Checkout is not connected yet (Paymob
// account under review), so the Pro button is shown disabled.
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
      { labelKey: 'pricing_feat_stability', free: 'pricing_val_stab_free', pro: 'pricing_val_stab_pro' },
      { labelKey: 'pricing_feat_regression', free: 'pricing_val_reg_free', pro: 'pricing_val_reg_pro' },
      { labelKey: 'pricing_feat_doe', free: 'pricing_val_doe_free', pro: 'pricing_val_doe_pro' },
      { labelKey: 'pricing_feat_gagerr', free: 'pricing_val_gage_free', pro: 'pricing_val_gage_pro' },
      { labelKey: 'pricing_feat_icmsf_risk', free: false, pro: true },
      { labelKey: 'pricing_feat_oee_next', free: false, pro: true },
    ],
  },
  {
    sectionKey: 'pricing_section_export',
    items: [
      { labelKey: 'pricing_feat_export_csv', free: 'pricing_val_watermark', pro: 'pricing_val_nowatermark' },
      { labelKey: 'pricing_feat_export_excel', free: false, pro: true },
      { labelKey: 'pricing_feat_save', free: false, pro: 'pricing_val_50projects' },
    ],
  },
]

function Check({ ok, t }: { ok: boolean | TKey; accent: string; muted: string; t: (k: TKey) => string }) {
  if (ok === false) return <span style={{ opacity: 0.35 }}>—</span>
  if (typeof ok === 'string') return <span>{t(ok)}</span>
  return <span>✓</span>
}

const PERIOD_KEY: Record<PeriodId, TKey> = {
  monthly: 'pricing_period_monthly',
  quarterly: 'pricing_period_quarterly',
  yearly: 'pricing_period_yearly',
}
const PER_KEY: Record<PeriodId, TKey> = {
  monthly: 'pricing_per_monthly',
  quarterly: 'pricing_per_quarterly',
  yearly: 'pricing_per_yearly',
}
const HOW_KEYS: TKey[] = ['pricing_how_1', 'pricing_how_2', 'pricing_how_3', 'pricing_how_4', 'pricing_how_5']

export default function PricingClient({ defaultRegion }: { defaultRegion: Region }) {
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  // Shared auth read (lib/authState.ts)
  const { user: authUser, loading: checkingAuth } = useAuthState()
  const loggedIn = !!authUser

  const freeCtaHref = loggedIn ? '/dashboard' : '/login?next=/dashboard'

  const [region, setRegion] = useState<Region>(defaultRegion)
  const [period, setPeriod] = useState<PeriodId>('yearly')
  const list = PRICES[region]
  const plan = list.plans.find((p) => p.id === period) ?? list.plans[list.plans.length - 1]
  const founding = FOUNDING.open
  const pay = founding ? plan.founding : plan.price
  const money = (n: number) => formatPrice(n, list.currency, lang)
  const save = savingPercent(list, plan, founding)
  const perMonth = plan.months > 1 ? money(Math.round((pay / plan.months) * 100) / 100) : null
  const foundingLine = FOUNDING.endsAt
    ? t('pricing_founding_until').replace('{d}', new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(FOUNDING.endsAt)))
    : t('pricing_founding_note').replace('{n}', String(FOUNDING.limit))

  const chip = (on: boolean): React.CSSProperties => ({
    minHeight: 36,
    padding: '0 14px',
    borderRadius: 999,
    border: `1px solid ${on ? c.gold : c.border}`,
    background: on ? `${c.gold}22` : 'transparent',
    color: c.text,
    fontSize: 13,
    fontWeight: on ? 700 : 500,
    cursor: 'pointer',
    font: 'inherit',
  })

  const cardBase: React.CSSProperties = {
    ...s.card,
    flex: 1,
    minWidth: 280,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  }
  const bulletList: React.CSSProperties = { margin: '0 0 20px', paddingInlineStart: 18, fontSize: 13, color: c.text, lineHeight: 2, flex: 1 }

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

        {/* Price list: Egypt (EGP) or Gulf & Middle East (USD) */}
        <div role="radiogroup" aria-label={t('pricing_region_label')} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 26 }}>
          <span style={{ fontSize: 13, color: c.muted }}>{t('pricing_region_label')}</span>
          {(['eg', 'me'] as Region[]).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={region === r} style={chip(region === r)} onClick={() => {
              setRegion(r)
              if (!PRICES[r].plans.some((p) => p.id === period)) setPeriod('yearly')
            }}>
              {t(r === 'eg' ? 'pricing_region_eg' : 'pricing_region_me')}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', maxWidth: 880, width: '100%', marginTop: 22 }}>
          <div style={cardBase}>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{t('pricing_free_name')}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: c.text, margin: '8px 0 2px' }}>{money(0)}</div>
            <div style={{ fontSize: 12, color: c.muted, marginBottom: 18 }}>{t('pricing_free_tagline')}</div>
            <ul style={bulletList}>
              {(['pricing_free_bullet_1', 'pricing_free_bullet_2', 'pricing_free_bullet_3', 'pricing_free_bullet_4', 'pricing_free_bullet_5'] as TKey[]).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
            {checkingAuth ? (
              <div style={{ ...s.exportBtn, opacity: 0.4, width: '100%' }}>{t('pricing_loading')}</div>
            ) : (
              <Link href={freeCtaHref} style={{ ...s.exportBtn, width: '100%', textDecoration: 'none', color: c.text }}>
                {loggedIn ? t('pricing_free_cta_dashboard') : t('pricing_free_cta_start')}
              </Link>
            )}
          </div>

          <div style={{ ...cardBase, border: `2px solid ${c.gold}` }}>
            {founding && (
              <span style={{ position: 'absolute', top: -12, insetInlineStart: 20, background: c.gold, color: c.onGold, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                {t('pricing_founding_badge')}
              </span>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginTop: 8 }}>{t('pricing_pro_name')}</div>

            <div role="radiogroup" aria-label={t('pricing_period_label')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 4px' }}>
              {list.plans.map((p) => {
                const pct = savingPercent(list, p, founding)
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={plan.id === p.id} style={chip(plan.id === p.id)} onClick={() => setPeriod(p.id)}>
                    {t(PERIOD_KEY[p.id])}{pct > 0 ? ` · ${t('pricing_save').replace('{n}', String(pct))}` : ''}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, margin: '10px 0 2px' }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: c.text }}>{money(pay)}</span>
              <span style={{ fontSize: 13, color: c.muted }}>{t(PER_KEY[plan.id])}</span>
            </div>
            <div style={{ fontSize: 12.5, color: c.muted, minHeight: 20, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
              {founding && <span style={{ textDecoration: 'line-through' }}>{t('pricing_regular').replace('{p}', money(plan.price))}</span>}
              {perMonth && <span>{t('pricing_equiv_month').replace('{p}', perMonth)}</span>}
              {save > 0 && <span style={{ color: c.gold, fontWeight: 700 }}>{t('pricing_save').replace('{n}', String(save))}</span>}
            </div>
            {founding && <div style={{ fontSize: 12, color: c.text, margin: '8px 0 0', lineHeight: 1.6 }}>{foundingLine}</div>}
            <div style={{ fontSize: 12, color: c.muted, margin: '6px 0 16px' }}>{t('pricing_once_note')}</div>

            <ul style={bulletList}>
              {(['pricing_pro_bullet_1', 'pricing_pro_bullet_2', 'pricing_pro_bullet_3', 'pricing_pro_bullet_4', 'pricing_pro_bullet_5'] as TKey[]).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
            <div aria-disabled="true" style={{ ...s.exportBtn, width: '100%', opacity: 0.6, cursor: 'default', borderColor: c.gold, color: c.gold }}>
              {t('pricing_pro_cta')}
            </div>
          </div>
        </div>

        {/* How paying works */}
        <div style={{ maxWidth: 880, width: '100%', marginTop: 32 }}>
          <div style={s.sectionTitle}>{t('pricing_how_title')}</div>
          <div style={{ ...s.card, padding: '18px 22px' }}>
            <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13.5, color: c.text, lineHeight: 1.9 }}>
              {HOW_KEYS.map((k) => <li key={k}>{t(k)}</li>)}
              <li>
                {t('pricing_how_refund')}{' '}
                <Link href="/refund-policy" style={{ color: c.accent, fontWeight: 600, textDecoration: 'none' }}>{t('bc_refund')}</Link>
              </li>
            </ul>
          </div>
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
