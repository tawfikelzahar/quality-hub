'use client'

import { type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { useSubscription } from '@/lib/useSubscription'
import { COLORS, BRAND_GRADIENT, BRAND_GRADIENT_TEXT_COLOR, type ThemeMode } from '@/lib/theme'

// ─────────────────────────────────────────────────────────────────────────
// Two reusable pieces for gating Pro features (Phase 4 of the subscription
// rollout — nothing is actually *applied* to a route or tool yet, that's
// Phase 5). Both manage their own `useSubscription()` call, same pattern
// already used in SaveAnalysisButton.tsx, so dropping either one into a
// page or a tool needs no extra wiring.
//
//   <LockedPage feature="Gage R&R" .../>
//     → full takeover for an entire route (Gage R&R / Stability / AQL).
//       Render this INSTEAD of the tool when !isPro; the page keeps its
//       own <nav>, this just fills the <main>.
//
//   <LockedSection feature="Nelson Rule Violations">...</LockedSection>
//     → wraps a chart/card *inside* a tool (e.g. inside SPC). Renders the
//       real children blurred underneath, with a small unlock overlay on
//       top, so the person can see there's something there worth paying
//       for instead of the section just vanishing.
//
// `previewLocked` on either component forces the locked UI to render
// regardless of actual plan — handy for visually testing/QA without
// having to downgrade a real account.
// ─────────────────────────────────────────────────────────────────────────

function LockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="11" width="16" height="10" rx="2" stroke={BRAND_GRADIENT_TEXT_COLOR} strokeWidth="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={BRAND_GRADIENT_TEXT_COLOR} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ── Full-page lock (route-level) ──────────────────────────────────────────

interface LockedPageProps {
  theme: ThemeMode
  feature: string
  description?: string
  bullets?: string[]
  previewLocked?: boolean
}

export function LockedPage({ theme, feature, description, bullets, previewLocked }: LockedPageProps) {
  const c = COLORS[theme]
  const { isPro, loading } = useSubscription()

  if (loading) return null
  if (isPro && !previewLocked) return null

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 16,
          padding: '40px 32px',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: BRAND_GRADIENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LockIcon size={24} />
        </div>

        <div style={{ fontSize: 18, fontWeight: 800, color: c.text, marginBottom: 8 }}>
          {feature} is a Pro feature
        </div>
        <p style={{ fontSize: 13, color: c.muted, lineHeight: 1.7, margin: '0 0 20px' }}>
          {description ?? `Upgrade to Pro to unlock ${feature} and the rest of the advanced toolkit.`}
        </p>

        {bullets && bullets.length > 0 && (
          <ul
            style={{
              textAlign: 'left',
              margin: '0 0 24px',
              padding: '16px 18px',
              background: c.surface2,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              fontSize: 13,
              color: c.text,
              lineHeight: 1.9,
              listStyle: 'none',
            }}
          >
            {bullets.map((b) => (
              <li key={b} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: c.accent }}>✓</span> {b}
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/pricing"
            style={{
              background: BRAND_GRADIENT,
              color: BRAND_GRADIENT_TEXT_COLOR,
              fontWeight: 700,
              fontSize: 13,
              padding: '10px 20px',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            View Pricing
          </Link>
          <Link
            href="/account"
            style={{
              background: c.surface2,
              border: `1px solid ${c.border}`,
              color: c.text,
              fontWeight: 600,
              fontSize: 13,
              padding: '10px 20px',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Go to Account
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Inline blurred section (component-level) ─────────────────────────────

interface LockedSectionProps {
  theme: ThemeMode
  feature: string
  description?: string
  minHeight?: number
  previewLocked?: boolean
  children: ReactNode
}

export function LockedSection({
  theme,
  feature,
  description,
  minHeight = 220,
  previewLocked,
  children,
}: LockedSectionProps) {
  const c = COLORS[theme]
  const { isPro, loading } = useSubscription()

  // While we don't know the plan yet, show the real content rather than
  // flashing a lock screen for a split second on every Pro user's page.
  if (loading) return <>{children}</>
  if (isPro && !previewLocked) return <>{children}</>

  const overlayCard: CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 12,
    padding: '20px 24px',
    textAlign: 'center',
    maxWidth: 320,
    boxShadow: theme === 'dark' ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(0,0,0,0.12)',
  }

  return (
    <div style={{ position: 'relative', minHeight, borderRadius: 12, overflow: 'hidden' }}>
      <div
        aria-hidden
        style={{
          filter: 'blur(5px)',
          opacity: 0.55,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {children}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div style={overlayCard}>
          <div
            style={{
              width: 36,
              height: 36,
              margin: '0 auto 10px',
              borderRadius: '50%',
              background: BRAND_GRADIENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LockIcon size={16} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 4 }}>
            {feature} — Pro Feature
          </div>
          {description && (
            <p style={{ fontSize: 12, color: c.muted, margin: '0 0 12px', lineHeight: 1.6 }}>{description}</p>
          )}
          <Link
            href="/pricing"
            style={{
              display: 'inline-block',
              marginTop: description ? 0 : 10,
              background: c.accent,
              color: '#060d1a',
              fontWeight: 700,
              fontSize: 12,
              padding: '7px 16px',
              borderRadius: 7,
              textDecoration: 'none',
            }}
          >
            Unlock with Pro
          </Link>
        </div>
      </div>
    </div>
  )
}
