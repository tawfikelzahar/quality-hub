'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useSubscription } from '@/lib/useSubscription'
import { COLORS, type ThemeMode } from '@/lib/theme'

export type SavableTool = 'spc' | 'pareto' | 'dpmo' | 'oee' | 'gage_rr' | 'stability' | 'aql'

interface SaveAnalysisButtonProps {
  theme: ThemeMode
  tool: SavableTool
  defaultName?: string
  // بترجع null لو معندناش نتيجة صالحة نحفظها دلوقتي (مثلًا لسه محصلش حساب،
  // أو فيه رسالة validation error) — الزرار وقتها هيقول "مفيش نتيجة للحفظ"
  // بدل ما يبعت طلب فاضي للسيرفر.
  getPayload: () => { input_data: unknown; results: unknown } | null
}

// زرار حفظ قابل لإعادة الاستخدام في أي أداة من السبعة. من غير أي افتراض
// عن الـ styles بتاعة الصفحة اللي حاطينه فيها (كل أداة عندها نسخة
// مختلفة شوية من "s")، فده بيجيب الألوان بنفسه من COLORS مباشرة.
export default function SaveAnalysisButton({ theme, tool, defaultName, getPayload }: SaveAnalysisButtonProps) {
  const c = COLORS[theme]
  const { isPro, loading } = useSubscription()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const btnStyle: CSSProperties = {
    background: c.surface2,
    border: `1px solid ${c.border}`,
    borderRadius: 9,
    color: c.text,
    padding: '9px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }

  const saveBtnStyle: CSSProperties = {
    ...btnStyle,
    background: `${c.accent}16`,
    border: `1px solid ${c.accent}55`,
    color: c.accent,
    fontWeight: 700,
  }

  async function handleSave() {
    const payload = getPayload()
    if (!payload) {
      setMessage({ text: 'No valid result to save yet.', ok: false })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    const name = window.prompt('Project name:', defaultName ?? '')
    if (!name || !name.trim()) return

    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/saved-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, name: name.trim(), ...payload }),
      })
      const json = await res.json()
      setMessage(
        res.ok ? { text: '✅ Saved successfully', ok: true } : { text: json.error ?? 'Failed to save.', ok: false }
      )
    } catch {
      setMessage({ text: 'Connection error.', ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (loading) return null

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {isPro ? (
        <button style={saveBtnStyle} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : '💾 Save Project'}
        </button>
      ) : (
        <Link href="/account" style={{ ...btnStyle, opacity: 0.75 }}>
          🔒 Save (Pro)
        </Link>
      )}
      {message && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            insetInlineEnd: 0,
            whiteSpace: 'nowrap',
            fontSize: 11,
            fontWeight: 600,
            color: message.ok ? '#22c55e' : c.danger,
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 6,
            padding: '4px 10px',
            zIndex: 10,
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}
