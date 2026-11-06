'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/LocaleLink'
import { createClient } from '@/lib/supabase'
import { COLORS, usePersistedTheme, BRAND_GRADIENT, BRAND_GRADIENT_TEXT_COLOR } from '@/lib/theme'
import { SITE } from '@/lib/site'
import { useLanguage } from '@/lib/i18n/context'
import { hereLocalized } from '@/lib/i18n/routing'

// ─────────────────────────────────────────────────────────────────────────
// Second half of "Forgot your password?" (app/[lang]/login).
// The reset email links to /auth/callback, which exchanges the one-time
// code for a session and sends the visitor here. With that session the
// new password is saved through supabase.auth.updateUser. Without one
// (link expired, already used, or opened in another browser) the page
// offers to send a new link instead.
// ─────────────────────────────────────────────────────────────────────────

const MIN_LENGTH = 8

export default function ResetPasswordClient() {
  const [theme] = usePersistedTheme()
  const { t } = useLanguage()
  const dark = theme === 'dark'
  const c = COLORS[theme]

  const textColor = dark ? '#f0f6ff' : c.text
  const mutedColor = dark ? '#6b89b4' : c.muted
  const labelColor = dark ? '#8fafd4' : c.muted
  const cardBg = dark ? 'rgba(11,22,40,.9)' : c.surface
  const cardBorder = dark ? 'color-mix(in srgb, var(--qh-accent) 15%, transparent)' : c.border
  const inputBg = dark ? 'rgba(255,255,255,.05)' : c.surface2
  const inputBorder = dark ? 'rgba(255,255,255,.1)' : c.border
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 10, color: textColor, fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: labelColor, display: 'block', marginBottom: 6 }
  const buttonStyle: React.CSSProperties = { width: '100%', padding: '13px', background: BRAND_GRADIENT, color: BRAND_GRADIENT_TEXT_COLOR, fontWeight: 700, fontSize: 15, borderRadius: 11, border: 'none', cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block', boxSizing: 'border-box' }

  const [status, setStatus] = useState<'checking' | 'ready' | 'expired' | 'done'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    createClient().auth.getUser().then(({ data }) => {
      if (alive) setStatus(data.user ? 'ready' : 'expired')
    })
    return () => { alive = false }
  }, [])

  async function save() {
    setMessage('')
    if (password.length < MIN_LENGTH) { setMessage('❌ ' + t('reset_err_short')); return }
    if (password !== confirm) { setMessage('❌ ' + t('reset_err_match')); return }
    setSaving(true)
    const { error } = await createClient().auth.updateUser({ password })
    setSaving(false)
    if (error) { setMessage('❌ ' + error.message); return }
    setStatus('done')
    setMessage('✅ ' + t('reset_done'))
    window.setTimeout(() => { window.location.href = hereLocalized('/') }, 2000)
  }

  const good = message.startsWith('✅')

  return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, marginBottom: 40 }}>
        <Link href="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dark ? SITE.logo.dark : SITE.logo.light} alt={SITE.name} style={{ height: 40, width: 'auto', display: 'block' }} />
        </Link>
      </div>

      <div style={{ width: '100%', maxWidth: 420, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 24, padding: 40, boxSizing: 'border-box' }}>
        {status === 'expired' ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: textColor }}>{t('reset_expired_title')}</h1>
            <p style={{ fontSize: 13, color: mutedColor, marginBottom: 28, lineHeight: 1.6 }}>{t('reset_expired_sub')}</p>
            <Link href="/login?forgot=1" style={buttonStyle}>{t('reset_expired_btn')}</Link>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: textColor }}>{t('reset_title')}</h1>
            <p style={{ fontSize: 13, color: mutedColor, marginBottom: 28, lineHeight: 1.6 }}>{t('reset_sub')}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>{t('reset_new')}</label>
                <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} disabled={status !== 'ready'} />
              </div>
              <div>
                <label style={labelStyle}>{t('reset_confirm')}</label>
                <input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="••••••••" style={inputStyle} disabled={status !== 'ready'} />
              </div>
            </div>

            {message && (
              <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 9, marginBottom: 16, background: good ? 'color-mix(in srgb, var(--qh-good) 10%, transparent)' : 'color-mix(in srgb, var(--qh-danger) 10%, transparent)', color: good ? 'var(--qh-good)' : '#f87171', border: `1px solid ${good ? 'color-mix(in srgb, var(--qh-good) 20%, transparent)' : 'color-mix(in srgb, var(--qh-danger) 20%, transparent)'}` }}>
                {message}
              </div>
            )}

            <button onClick={save} disabled={status !== 'ready' || saving} style={{ ...buttonStyle, opacity: status !== 'ready' || saving ? 0.7 : 1 }}>
              {saving || status === 'checking' ? t('login_wait') : t('reset_btn')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
