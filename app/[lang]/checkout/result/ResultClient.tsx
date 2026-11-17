'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/LocaleLink'
import Nav from '@/components/Nav'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import { useLanguage } from '@/lib/i18n/context'
import { refreshAuthState } from '@/lib/authState'
import { track } from '@/lib/analytics'
import { SITE } from '@/lib/site'

// GA4 purchase, once per payment. The figures come from /api/paymob/status,
// i.e. the payment Paymob's signed callback confirmed, never from the address
// bar. A payment made with Paymob's test keys is logged to the console only,
// so test runs never count as revenue.
interface PaidPayment { id?: string; plan?: string; months?: number; amount?: number; currency?: string; founding?: boolean; mode?: string }
function sendPurchase(p: PaidPayment) {
  if (!p.id || typeof p.amount !== 'number' || !p.currency) return
  const key = `qh-ga-purchase-${p.id}`
  try { if (localStorage.getItem(key)) return } catch { /* storage blocked: GA still de-duplicates on transaction_id */ }
  if (p.mode !== 'live') {
    console.info('[ga] purchase (test payment, not sent)', p)
    return
  }
  track('purchase', {
    transaction_id: p.id,
    value: p.amount,
    currency: p.currency,
    plan: p.plan,
    months: p.months,
    founding: !!p.founding,
    items: [{ item_id: `pro_${p.plan}`, item_name: `${SITE.name} Pro (${p.plan})`, price: p.amount, quantity: 1 }],
  })
  try { localStorage.setItem(key, '1') } catch { /* see above */ }
}

type View = 'checking' | 'paid' | 'failed' | 'waiting'

const TRIES = 20 // 20 × 2 s = 40 s of waiting for Paymob's callback

export default function ResultClient() {
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const [view, setView] = useState<View>('checking')
  const [until, setUntil] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Ask the server until Paymob's callback has landed (or we give up for now).
  useEffect(() => {
    let cancelled = false
    async function poll() {
      for (let i = 0; i < TRIES && !cancelled; i++) {
        try {
          const res = await fetch('/api/paymob/status', { cache: 'no-store' })
          const json = await res.json().catch(() => ({}))
          if (cancelled) return
          if (res.status === 401) break // signed out: nothing to look up
          if (json.status === 'paid') {
            sendPurchase(json)
            setUntil(typeof json.proUntil === 'string' ? json.proUntil : null)
            setView('paid')
            void refreshAuthState()
            return
          }
          if (json.status === 'failed') { setView('failed'); return }
        } catch { /* keep trying */ }
        await new Promise((r) => setTimeout(r, 2000))
      }
      if (!cancelled) setView('waiting')
    }
    void poll()
    return () => { cancelled = true }
  }, [attempt])

  const again = () => { setView('checking'); setAttempt((n) => n + 1) }

  const date = until
    ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(until))
    : ''
  const title = view === 'paid' ? t('res_paid_title') : view === 'failed' ? t('res_failed_title') : view === 'waiting' ? t('res_wait_title') : t('res_checking_title')
  const text = view === 'paid' ? (date ? t('res_paid_text').replace('{d}', date) : t('res_paid_text_open'))
    : view === 'failed' ? t('res_failed_text') : view === 'waiting' ? t('res_wait_text') : t('res_checking_text')
  const btn: React.CSSProperties = { ...s.exportBtn, textDecoration: 'none', background: c.gold, color: c.onGold, borderColor: c.gold, fontWeight: 700, minWidth: 220 }

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_checkout" showGetPro={false} />
      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <section role="status" aria-live="polite" style={{ ...s.card, maxWidth: 520, width: '100%', marginTop: 40, padding: '32px 26px', textAlign: 'center' }}>
          <div aria-hidden style={{ fontSize: 34, marginBottom: 10, color: view === 'paid' ? c.gold : view === 'failed' ? c.danger : c.muted }}>
            {view === 'paid' ? '✓' : view === 'failed' ? '✕' : '…'}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: c.text, margin: '0 0 10px' }}>{title}</h1>
          <p style={{ fontSize: 14, color: c.muted, lineHeight: 1.8, margin: '0 0 20px' }}>{text}</p>
          {view === 'paid' && <Link href="/account#branding" style={btn}>{t('res_paid_cta')}</Link>}
          {view === 'failed' && <Link href="/checkout" style={btn}>{t('res_failed_cta')}</Link>}
          {view === 'waiting' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              <button type="button" onClick={again} style={{ ...btn, cursor: 'pointer' }}>{t('res_wait_cta')}</button>
              <Link href="/contact" style={{ ...s.exportBtn, textDecoration: 'none', color: c.text }}>{t('footer_contact')}</Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
