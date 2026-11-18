'use client'

import { useState } from 'react'
import Link from '@/components/LocaleLink'
import Nav from '@/components/Nav'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import { useLanguage } from '@/lib/i18n/context'
import PaymentLogos from '@/components/PaymentLogos'
import type { TKey } from '@/lib/i18n/translations'
import { useAuthState } from '@/lib/authState'
import { localizePath } from '@/lib/i18n/routing'
import { SITE } from '@/lib/site'
import { PRICES, formatPrice, savingPercent, type PeriodId, type Region } from '@/lib/pricing'

// Order summary and the "Pay" button. Everything shown here (price list,
// founding price, whether checkout is open) comes from the server page; the
// amount charged is worked out again on the server when Pay is pressed.

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

export default function CheckoutClient({ region, state, testMode, founding, initialPlan, asCountry = '' }: {
  region: Region
  state: 'open' | 'soon' | 'region'
  testMode: boolean
  founding: boolean
  /** ?plan= from the address, read on the server so both renders agree */
  initialPlan: string
  /** admin preview of another country (?as=), sent on to the payment API */
  asCountry?: string
}) {
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const { user, loading } = useAuthState()

  const list = PRICES[region]
  const [period, setPeriod] = useState<PeriodId>(list.plans.find((p) => p.id === initialPlan)?.id ?? 'yearly')
  const plan = list.plans.find((p) => p.id === period) ?? list.plans[list.plans.length - 1]
  const pay = founding ? plan.founding : plan.price
  const money = (n: number) => formatPrice(n, list.currency, lang)

  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function start() {
    const clean = phone.replace(/[\s()-]/g, '')
    if (!/^\+?\d{8,15}$/.test(clean)) { setError(t('co_phone_err')); return }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/paymob/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id, phone: clean, lang, ...(asCountry ? { as: asCountry } : {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && typeof json.url === 'string') { window.location.assign(json.url); return }
      setError(json.code === 'phone' ? t('co_phone_err') : json.code === 'login' ? t('co_signin') : t('co_err'))
    } catch {
      setError(t('co_err'))
    }
    setBusy(false)
  }

  const chip = (on: boolean): React.CSSProperties => ({
    minHeight: 36, padding: '0 14px', borderRadius: 999,
    border: `1px solid ${on ? c.gold : c.border}`,
    background: on ? `${c.gold}22` : 'transparent',
    color: c.text, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', font: 'inherit',
  })
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '10px 0', borderBottom: `1px solid ${c.border}`, fontSize: 14 }
  const loginHref = `${localizePath('/login', lang)}?next=${encodeURIComponent(localizePath(`/checkout?plan=${plan.id}`, lang))}`

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_checkout" showGetPro={false} />
      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <div style={{ maxWidth: 560, width: '100%', marginTop: 20, marginBottom: 40 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: c.text, margin: '0 0 18px', textAlign: 'center' }}>{t('co_title')}</h1>

          {testMode && (
            <div role="note" style={{ border: `1px dashed ${c.gold}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: c.text }}>
              {t('co_test_banner')}
            </div>
          )}

          <section style={{ ...s.card, padding: '20px 22px' }} aria-labelledby="co-summary-h">
            <h2 id="co-summary-h" style={{ fontSize: 15, fontWeight: 700, color: c.text, margin: '0 0 12px' }}>{t('co_summary')}</h2>

            <div role="radiogroup" aria-label={t('pricing_period_label')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {list.plans.map((p) => {
                const pct = savingPercent(list, p, founding)
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={plan.id === p.id} style={chip(plan.id === p.id)} onClick={() => setPeriod(p.id)}>
                    {t(PERIOD_KEY[p.id])}{pct > 0 ? ` · ${t('pricing_save').replace('{n}', String(pct))}` : ''}
                  </button>
                )
              })}
            </div>

            <div style={row}>
              <span style={{ color: c.muted }}>{t('co_item')}</span>
              <span style={{ color: c.text, fontWeight: 600 }}>{SITE.name} Pro · {t(PER_KEY[plan.id])}</span>
            </div>
            <div style={row}>
              <span style={{ color: c.muted }}>{founding ? t('co_founding') : t('co_price')}</span>
              <span style={{ color: c.text }}>
                {founding && <span style={{ textDecoration: 'line-through', color: c.muted, marginInlineEnd: 10 }}>{money(plan.price)}</span>}
                {money(pay)}
              </span>
            </div>
            <div style={{ ...row, borderBottom: 'none', fontSize: 16 }}>
              <span style={{ color: c.text, fontWeight: 700 }}>{t('co_total')}</span>
              <span style={{ color: c.text, fontWeight: 800 }}>{money(pay)}</span>
            </div>

            <ul style={{ margin: '8px 0 0', paddingInlineStart: 18, fontSize: 12.5, color: c.muted, lineHeight: 1.8 }}>
              <li>{t('co_once')}</li>
              {region === 'me' && <li>{t('pricing_egp_note')}</li>}
              <li>{t('co_dates_note')}</li>
              <li>{t('co_secure')}</li>
            </ul>
          </section>

          <section style={{ ...s.card, padding: '20px 22px', marginTop: 14 }}>
            {state !== 'open' ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginBottom: 6 }}>{t('co_soon_title')}</div>
                <p style={{ fontSize: 13.5, color: c.muted, lineHeight: 1.8, margin: '0 0 14px' }}>{t(state === 'region' ? 'co_region_text' : 'co_soon_text')}</p>
                <div aria-disabled="true" style={{ ...s.exportBtn, width: '100%', opacity: 0.6, cursor: 'default', borderColor: c.gold, color: c.gold }}>
                  {t('co_pay').replace('{p}', money(pay))}
                </div>
              </>
            ) : loading ? (
              <div style={{ ...s.exportBtn, opacity: 0.4, width: '100%' }}>{t('pricing_loading')}</div>
            ) : !user ? (
              <>
                <p style={{ fontSize: 13.5, color: c.muted, lineHeight: 1.8, margin: '0 0 14px' }}>{t('co_signin')}</p>
                <a href={loginHref} style={{ ...s.exportBtn, width: '100%', textDecoration: 'none', background: c.gold, color: c.onGold, borderColor: c.gold }}>
                  {t('co_signin_cta')}
                </a>
              </>
            ) : (
              <>
                <label htmlFor="co-phone" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 6 }}>{t('co_phone')}</label>
                <input
                  id="co-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 42, padding: '0 12px', borderRadius: 10, border: `1px solid ${c.border}`, background: c.surface2, color: c.text, fontSize: 15 }}
                />
                <div style={{ fontSize: 12, color: c.muted, margin: '6px 0 14px' }}>{t('co_phone_hint')}</div>
                {error && <div role="alert" style={{ fontSize: 13, color: c.danger, marginBottom: 10 }}>{error}</div>}
                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={busy}
                  style={{ ...s.exportBtn, width: '100%', background: c.gold, color: c.onGold, borderColor: c.gold, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? t('co_paying') : t('co_pay').replace('{p}', money(pay))}
                </button>
              </>
            )}
            <div style={{ marginTop: 14 }}><PaymentLogos align="center" /></div>
            <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.8, margin: '14px 0 0' }}>
              {t('co_agree_prefix')}{' '}
              <Link href="/terms" style={{ color: c.accent, textDecoration: 'none' }}>{t('bc_terms')}</Link>{' '}
              {t('co_agree_and')}{' '}
              <Link href="/refund-policy" style={{ color: c.accent, textDecoration: 'none' }}>{t('bc_refund')}</Link>
            </p>
          </section>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
            <Link href="/pricing" style={{ color: c.muted, textDecoration: 'none' }}>← {t('co_back')}</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
