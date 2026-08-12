'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'

// ─────────────────────────────────────────────────────────────────────────
// Pricing is intentionally static for now (Phase 3 of the subscription
// rollout plan). No real checkout yet — that's Phase 6 (Lemon Squeezy).
// The Pro CTA sends the person to /account, where the real
// "Upgrade to Pro — Coming Soon" stub already lives.
//
// PRICE_LABEL is the one thing you'll want to edit once pricing is final —
// it's a plain string so no other part of the page needs to change.
// ─────────────────────────────────────────────────────────────────────────
const PRICE_LABEL = 'Coming Soon'

interface Feature {
  label: string
  free: boolean | string
  pro: boolean | string
}

const FEATURES: { section: string; items: Feature[] }[] = [
  {
    section: 'SPC Engine',
    items: [
      { label: 'I-MR & X̄-R charts', free: true, pro: true },
      { label: 'Capability indices (Cp/Cpk/Pp/Ppk)', free: true, pro: true },
      { label: 'Attribute charts (p/np/c/u)', free: false, pro: true },
      { label: 'Nelson Rule violations', free: false, pro: true },
      { label: 'Anderson-Darling normality test', free: false, pro: true },
      { label: 'Distribution / ECDF charts', free: false, pro: true },
    ],
  },
  {
    section: 'Other Tools',
    items: [
      { label: 'Pareto Chart', free: true, pro: true },
      { label: 'DPMO & Sigma Calculator', free: true, pro: true },
      { label: 'OEE Calculator', free: true, pro: true },
      { label: 'Gage R&R (AIAG Average & Range)', free: false, pro: true },
      { label: 'Stability Study', free: false, pro: true },
      { label: 'AQL Sampling Plan Calculator', free: false, pro: true },
    ],
  },
  {
    section: 'Export & Projects',
    items: [
      { label: 'Export to CSV / PNG', free: 'With watermark', pro: 'No watermark' },
      { label: 'Export to Excel / PDF', free: false, pro: true },
      { label: 'Save projects & Cloud Sync', free: false, pro: 'Up to 50 projects' },
      { label: 'Projects Dashboard', free: false, pro: true },
    ],
  },
]

function Check({ ok }: { ok: boolean | string; accent: string; muted: string }) {
  if (ok === false) return <span style={{ opacity: 0.35 }}>—</span>
  if (typeof ok === 'string') return <span>{ok}</span>
  return <span>✓</span>
}

export default function PricingPage() {
  const [theme, setTheme] = usePersistedTheme()
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
          RECOMMENDED
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
        <div style={{ ...s.exportBtn, opacity: 0.4, width: '100%' }}>Loading...</div>
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
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 14, color: c.muted, margin: 0 }}>
            Start free with the core tools. Upgrade when you need advanced analysis, more exports, and saved projects.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', maxWidth: 880, width: '100%', marginTop: 28 }}>
          {planCard({
            name: 'Free',
            price: '$0',
            tagline: 'Forever free — no credit card needed',
            bullets: [
              'SPC Engine (I-MR, X̄-R, capability)',
              'Pareto Chart',
              'DPMO & Sigma Calculator',
              'OEE Calculator',
              'CSV / PNG export (watermarked)',
            ],
            cta: loggedIn ? 'Go to Dashboard' : 'Get Started Free',
            href: freeCtaHref,
          })}
          {planCard({
            name: 'Pro',
            price: PRICE_LABEL,
            tagline: 'Everything in Free, plus the full toolkit',
            bullets: [
              'Everything in Free',
              'Attribute charts, Nelson Rules & normality tests',
              'Gage R&R, Stability Study & AQL Calculator',
              'Excel / PDF export — no watermark',
              'Save projects, Cloud Sync & Dashboard (up to 50)',
            ],
            cta: 'Upgrade to Pro',
            href: proCtaHref,
            highlight: true,
          })}
        </div>

        {/* Feature comparison table */}
        <div style={{ maxWidth: 880, width: '100%', marginTop: 40 }}>
          <div style={s.sectionTitle}>Full Feature Comparison</div>
          <div style={s.chartWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Feature</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Free</th>
                  <th style={{ ...s.th, textAlign: 'center', color: c.accent }}>Pro</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((group) => (
                  <>
                    <tr key={group.section}>
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
                        {group.section}
                      </td>
                    </tr>
                    {group.items.map((f) => (
                      <tr key={f.label}>
                        <td style={s.td}>{f.label}</td>
                        <td style={{ ...s.td, textAlign: 'center', color: c.muted }}>
                          <Check ok={f.free} accent={c.accent} muted={c.muted} />
                        </td>
                        <td style={{ ...s.td, textAlign: 'center', color: c.accent, fontWeight: 600 }}>
                          <Check ok={f.pro} accent={c.accent} muted={c.muted} />
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
          Questions about a plan?{' '}
          <Link href="/account" style={{ color: c.accent, textDecoration: 'none', fontWeight: 600 }}>
            Visit your account page
          </Link>{' '}
          for the current status of your plan.
        </div>
      </main>
    </div>
  )
}
