'use client'

import { useState } from 'react'
import { COLORS, getSharedStyles, type ThemeMode } from '@/lib/theme'
import { useLanguage } from '@/lib/i18n/context'
import { goToLogin, goToPricing } from '@/lib/exportGate'
import type { AITool, VariableChartSummary } from '@/lib/ai/insight'

// ─────────────────────────────────────────────────────────────────────────
// AI Insights card — Pro-only, shown under a tool's results.
// The server re-checks login + Pro + the daily limit on every request, so
// the isPro check here only decides which button to show.
// The answer is in the page's active language at the moment of the click.
// ─────────────────────────────────────────────────────────────────────────

interface AIInsightCardProps {
  theme: ThemeMode
  tool: AITool
  isPro: boolean
  isLoggedIn: boolean
  getSummary: () => VariableChartSummary | null
  // Changes whenever the analysis changes, so an old insight is cleared.
  resultKey: unknown
  // true (default): non-Pro visitors see a locked card that leads to login
  // or /pricing and fires the GA4 gate event with feature 'ai'.
  // false: hide the card entirely from non-Pro visitors.
  showLockedTeaser?: boolean
}

type ErrorCode = 'login' | 'pro' | 'limit' | 'not_configured' | 'generic'

export default function AIInsightCard({ theme, tool, isPro, isLoggedIn, getSummary, resultKey, showLockedTeaser = true }: AIInsightCardProps) {
  const { lang, t } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  const [text, setText] = useState('')
  const [textLang, setTextLang] = useState<'en' | 'ar'>(lang)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  // A new analysis makes the previous insight stale.
  const [prevKey, setPrevKey] = useState(resultKey)
  if (prevKey !== resultKey) {
    setPrevKey(resultKey)
    setText('')
    setError(null)
  }

  async function generate() {
    if (!isLoggedIn) { goToLogin(tool, 'ai'); return }
    if (!isPro) { goToPricing(tool, 'ai'); return }
    const summary = getSummary()
    if (!summary) return

    setLoading(true)
    setError(null)
    const requestLang = lang
    try {
      const res = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool, lang: requestLang, summary }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        text?: string
        code?: string
        remaining?: number
      }
      if (typeof data.remaining === 'number') setRemaining(data.remaining)
      if (!res.ok || !data.text) {
        const code = data.code
        setError(
          code === 'login' || code === 'pro' || code === 'limit' || code === 'not_configured'
            ? code
            : 'generic',
        )
        return
      }
      setText(data.text)
      setTextLang(requestLang)
    } catch {
      setError('generic')
    } finally {
      setLoading(false)
    }
  }

  const errorKey = error ? (`ai_err_${error}` as const) : null
  const locked = !isPro
  if (locked && !showLockedTeaser) return null

  return (
    <div style={{ ...s.card, border: `1px solid ${c.accent}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ ...s.sectionTitle, marginBottom: 4 }}>✨ {t('ai_title')}</div>
          <p style={{ fontSize: 12, color: c.muted, margin: 0 }}>{t('ai_subtitle')}</p>
        </div>
        <button
          style={{ ...s.saveBtn, opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}
          onClick={generate}
          disabled={loading}
        >
          {locked
            ? `🔒 ${t('ai_button_locked')}`
            : loading
              ? t('ai_loading')
              : `✨ ${text ? t('ai_button_again') : t('ai_button')}`}
        </button>
      </div>

      {errorKey && (
        <p style={{ fontSize: 13, color: error === 'limit' ? c.amber : c.danger, marginTop: 14, marginBottom: 0 }}>
          {t(errorKey)}
        </p>
      )}

      {text && (
        <div
          dir={textLang === 'ar' ? 'rtl' : 'ltr'}
          style={{
            marginTop: 14,
            padding: '14px 16px',
            borderRadius: 10,
            background: c.surface2,
            border: `1px solid ${c.border}`,
            color: c.text,
            fontSize: 14,
            lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </div>
      )}

      {(text || remaining !== null) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          {text && <p style={{ fontSize: 11, color: c.muted, margin: 0, flex: '1 1 240px' }}>{t('ai_disclaimer')}</p>}
          {remaining !== null && (
            <p style={{ fontSize: 11, color: c.muted, margin: 0 }}>{t('ai_remaining').replace('{n}', String(remaining))}</p>
          )}
        </div>
      )}
    </div>
  )
}
