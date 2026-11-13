'use client'

// ─────────────────────────────────────────────────────────────────────────
// Founding price countdown (pricing page).
//
// Shows days · hours · minutes · seconds until `endsAt` (lib/pricing.ts
// FOUNDING.endsAt) and calls onEnd once when it reaches zero, so the page
// can switch to the regular price without a reload. Nothing is rendered
// before the component mounts: the server and the browser clocks differ, and
// a server-rendered number would flash a wrong value.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n/context'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export function splitRemaining(ms: number) {
  const left = Math.max(0, ms)
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor((left % DAY) / HOUR),
    minutes: Math.floor((left % HOUR) / MIN),
    seconds: Math.floor((left % MIN) / SEC),
  }
}

export default function FoundingCountdown({ endsAt, onEnd, gold, border, muted, text }: {
  /** closing moment in ms */
  endsAt: number
  onEnd?: () => void
  gold: string
  border: string
  muted: string
  text: string
}) {
  const { t } = useLanguage()
  const [now, setNow] = useState<number | null>(null)
  const ended = useRef(false)

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, SEC)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (now !== null && now >= endsAt && !ended.current) {
      ended.current = true
      onEnd?.()
    }
  }, [now, endsAt, onEnd])

  if (now === null || now >= endsAt) return null

  const r = splitRemaining(endsAt - now)
  const cells: [number, string][] = [
    [r.days, t('pricing_cd_days')],
    [r.hours, t('pricing_cd_hours')],
    [r.minutes, t('pricing_cd_minutes')],
    [r.seconds, t('pricing_cd_seconds')],
  ]

  return (
    <div role="timer" aria-label={t('pricing_cd_label')} style={{ margin: '10px 0 0' }}>
      <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>{t('pricing_cd_label')}</div>
      {/* follows the page direction: days come first in the reading order */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {cells.map(([n, label], i) => (
          <div
            key={label}
            style={{
              border: `1px solid ${i === 0 ? gold : border}`,
              background: i === 0 ? `${gold}1f` : 'transparent',
              borderRadius: 8,
              padding: '6px 4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
              {String(n).padStart(2, '0')}
            </div>
            <div style={{ fontSize: 10.5, color: i === 0 ? text : muted }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
