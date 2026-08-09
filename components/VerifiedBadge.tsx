'use client'

import { useState, type CSSProperties } from 'react'
import { COLORS, type ThemeMode } from '@/lib/theme'

// ─────────────────────────────────────────────────────────────────────────
// Small trust indicator for tools whose reference tables/formulas were
// manually cross-checked against the official standard. Click/tap to expand
// a one-line explanation of how it was verified — keeps the page uncluttered
// for people who don't care, while giving quality engineers (who DO care
// about traceability) a real answer instead of a marketing badge.
//
// Usage:
//   <VerifiedBadge
//     theme={theme}
//     standard="ISO 2859-1:2026"
//     detail="Every Ac/Re value in the Normal, Tightened and Reduced tables
//       was cross-checked cell-by-cell against the official ISO PDF —
//       zero mismatches."
//   />
// ─────────────────────────────────────────────────────────────────────────

export function VerifiedBadge({
  theme,
  standard,
  detail,
}: {
  theme: ThemeMode
  standard: string
  detail: string
}) {
  const [open, setOpen] = useState(false)
  const c = COLORS[theme]
  const dark = theme === 'dark'

  const pill: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: c.accent,
    background: dark ? 'rgba(15,212,200,.08)' : 'rgba(14,116,116,.06)',
    border: `1px solid ${dark ? 'rgba(15,212,200,.22)' : 'rgba(14,116,116,.2)'}`,
    borderRadius: 20,
    padding: '5px 12px',
    cursor: 'pointer',
    userSelect: 'none',
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...pill, font: 'inherit' }}
        aria-expanded={open}
      >
        <span style={{ fontSize: 13 }}>✓</span>
        Verified against {standard}
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <p
          style={{
            fontSize: 12,
            color: c.muted,
            lineHeight: 1.6,
            maxWidth: 560,
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          {detail}
        </p>
      )}
    </div>
  )
}
