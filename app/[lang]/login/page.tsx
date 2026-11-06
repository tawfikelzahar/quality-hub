'use client'

import { track } from '@/lib/analytics'
import { useState } from 'react'
import Link from '@/components/LocaleLink'
import { createClient } from '@/lib/supabase'
import { compressAvatar } from '@/lib/avatar'
import { COLORS, usePersistedTheme, BRAND_GRADIENT, BRAND_GRADIENT_TEXT_COLOR } from '@/lib/theme'
import { SITE } from '@/lib/site'
import { useLanguage } from '@/lib/i18n/context'
import LanguageToggle from '@/components/LanguageToggle'
import { hereLocalized } from '@/lib/i18n/routing'

function getNextPath() {
  if (typeof window === 'undefined') return '/'
  return new URLSearchParams(window.location.search).get('next') || '/'
}

/** /login?forgot=1 opens straight on the reset form (used by the expired-link page). */
function startMode(): 'login' | 'forgot' {
  if (typeof window === 'undefined') return 'login'
  return new URLSearchParams(window.location.search).get('forgot') === '1' ? 'forgot' : 'login'
}

// Keeps the avatar under 5MB and makes sure it's actually an image before
// we bother uploading it.
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export default function LoginPage() {
  const [theme, setTheme] = usePersistedTheme()
  const { t } = useLanguage()
  const dark = theme === 'dark'
  const c = COLORS[theme]

  // Local tokens so every hardcoded color below has a light-mode
  // counterpart — this page used to always render dark regardless of the
  // site-wide theme toggle, which was jarring when the rest of the app
  // was in light mode. Values mirror the ones already used on the landing
  // page / shared theme so this still looks like the same product.
  const pageBg = c.bg
  const textColor = dark ? '#f0f6ff' : c.text
  const mutedColor = dark ? '#6b89b4' : c.muted
  const softMuted = dark ? '#4a6080' : c.muted
  const labelColor = dark ? '#8fafd4' : c.muted
  const cardBg = dark ? 'rgba(11,22,40,.9)' : c.surface
  const cardBorder = dark ? 'color-mix(in srgb, var(--qh-accent) 15%, transparent)' : c.border
  const toggleTrackBg = dark ? 'rgba(255,255,255,.04)' : c.surface2
  const activeTabBg = dark ? 'color-mix(in srgb, var(--qh-accent) 15%, transparent)' : `${c.accent}18`
  const dividerColor = dark ? 'rgba(255,255,255,.08)' : c.border
  const inputBg = dark ? 'rgba(255,255,255,.05)' : c.surface2
  const inputBorder = dark ? 'rgba(255,255,255,.1)' : c.border
  const avatarPlaceholderBg = dark ? 'rgba(255,255,255,.06)' : c.surface2
  const avatarPlaceholderBorder = dark ? 'rgba(255,255,255,.15)' : c.border

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(startMode)

  async function handleAvatarChange(file: File | null) {
    if (!file) { setAvatarFile(null); setAvatarPreview(null); return }
    if (!file.type.startsWith('image/')) { setError('❌ ' + t('login_err_image')); return }
    if (file.size > MAX_AVATAR_BYTES) { setError('❌ ' + t('login_err_size')); return }
    setError('')
    const compressed = await compressAvatar(file)
    setAvatarFile(compressed)
    setAvatarPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const supabase = createClient()

    if (mode === 'forgot') {
      if (!email.trim()) { setError('❌ ' + t('login_err_email')); setLoading(false); return }
      // The link in the email comes back through /auth/callback, which signs
      // the visitor in and sends them to the page where they pick a new password.
      const next = hereLocalized('/reset-password')
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      })
      // Same message whether or not the email has an account, so the form
      // can't be used to find out who is registered.
      setError('✅ ' + t('login_forgot_sent'))
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      if (!firstName.trim() || !lastName.trim()) {
        setError('❌ ' + t('login_err_name'))
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
          },
        },
      })
      if (error) { setError(error.message); setLoading(false); return }

      // Avatar upload is optional and only works once the user has a
      // session (i.e. if email confirmation is off, or on next login).
      if (avatarFile && data.user) {
        const path = `${data.user.id}/avatar-${Date.now()}.${avatarFile.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
          await supabase.auth.updateUser({ data: { avatar_url: urlData.publicUrl } })
        }
      }

      track('sign_up', { method: 'email' })
      setError('✅ ' + t('login_check_email'))
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    track('login', { method: 'email' })
    // A full navigation (not router.push) guarantees the browser sends the
    // freshly-set session cookie on this request, so the proxy/middleware
    // auth check on the destination route sees it immediately instead of
    // racing with a soft client-side transition.
    window.location.href = hereLocalized(getNextPath())
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    const supabase = createClient()
    const next = hereLocalized(getNextPath())
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
  }

  return (
    <div style={{minHeight:'100vh',background:pageBg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:'system-ui,sans-serif',transition:'background .2s ease'}}>

      {/* Logo + theme toggle */}
      <div style={{width:'100%',maxWidth:420,display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:40}}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none',color:textColor,fontWeight:800,fontSize:18}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dark ? SITE.logo.dark : SITE.logo.light} alt={SITE.name} style={{height:40,width:'auto',display:'block'}} />
        </Link>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
        <LanguageToggle theme={theme} />
        <button
          onClick={() => setTheme(m => m === 'dark' ? 'light' : 'dark')}
          style={{background:dark?'rgba(255,255,255,0.08)':c.surface2,border:`1px solid ${c.border}`,borderRadius:20,padding:'5px 14px',color:textColor,cursor:'pointer',fontSize:12,fontWeight:600}}
        >
          {dark ? `☀️ ${t('theme_light')}` : `🌙 ${t('theme_dark')}`}
        </button>
        </div>
      </div>

      {/* Card */}
      <div style={{width:'100%',maxWidth:420,background:cardBg,border:`1px solid ${cardBorder}`,borderRadius:24,padding:40}}>

        {/* Toggle */}
        <div style={{display:'flex',background:toggleTrackBg,borderRadius:12,padding:4,marginBottom:32}}>
          {(['login','signup'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{flex:1,padding:'9px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:600,fontSize:13,transition:'all .2s',background: mode===m ? activeTabBg : 'transparent',color: mode===m ? c.accent : mutedColor}}>
              {m === 'login' ? t('login_tab_in') : t('login_tab_up')}
            </button>
          ))}
        </div>

        <h1 style={{fontSize:22,fontWeight:800,marginBottom:6,color:textColor}}>
          {mode === 'login' ? t('login_title_in') : mode === 'signup' ? t('login_title_up') : t('login_title_forgot')}
        </h1>
        <p style={{fontSize:13,color:mutedColor,marginBottom:28}}>
          {mode === 'login' ? t('login_sub_in') : mode === 'signup' ? t('login_sub_up') : t('login_sub_forgot')}
        </p>

        {/* Google Sign In */}
        {mode !== 'forgot' && (<>
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'12px',background:'#fff',color:'#1f2937',fontWeight:600,fontSize:14,borderRadius:11,border:'1px solid rgba(0,0,0,.08)',cursor:'pointer',marginBottom:20,opacity:googleLoading?.7:1}}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.85.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
          {t('login_google')}
        </button>

        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <div style={{flex:1,height:1,background:dividerColor}}/>
          <span style={{fontSize:11,color:softMuted}}>{t('login_or')}</span>
          <div style={{flex:1,height:1,background:dividerColor}}/>
        </div>
        </>)}

        {/* Fields */}
        <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
          {mode === 'signup' && (
            <>
              <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                <div style={{flex:'1 1 140px'}}>
                  <label style={{fontSize:12,fontWeight:600,color:labelColor,display:'block',marginBottom:6}}>{t('login_first')}</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Tawfik"
                    style={{width:'100%',padding:'12px 14px',background:inputBg,border:`1px solid ${inputBorder}`,borderRadius:10,color:textColor,fontSize:14,outline:'none',boxSizing:'border-box'}}
                  />
                </div>
                <div style={{flex:'1 1 140px'}}>
                  <label style={{fontSize:12,fontWeight:600,color:labelColor,display:'block',marginBottom:6}}>{t('login_last')}</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Elzahar"
                    style={{width:'100%',padding:'12px 14px',background:inputBg,border:`1px solid ${inputBorder}`,borderRadius:10,color:textColor,fontSize:14,outline:'none',boxSizing:'border-box'}}
                  />
                </div>
              </div>

              <div>
                <label style={{fontSize:12,fontWeight:600,color:labelColor,display:'block',marginBottom:6}}>{t('login_photo')}</label>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="Preview" width={44} height={44} style={{borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
                  ) : (
                    <div style={{width:44,height:44,borderRadius:'50%',background:avatarPlaceholderBg,border:`1px dashed ${avatarPlaceholderBorder}`,flexShrink:0}} />
                  )}
                  <label style={{fontSize:12,fontWeight:600,color:c.accent,cursor:'pointer',padding:'8px 14px',border:`1px solid ${c.accent}4d`,borderRadius:8}}>
                    {avatarFile ? t('login_photo_change') : t('login_photo_upload')}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleAvatarChange(e.target.files?.[0] ?? null)}
                      style={{display:'none'}}
                    />
                  </label>
                </div>
              </div>
            </>
          )}
          <div>
            <label style={{fontSize:12,fontWeight:600,color:labelColor,display:'block',marginBottom:6}}>{t('login_email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => mode === 'forgot' && e.key === 'Enter' && handleSubmit()}
              placeholder="you@company.com"
              style={{width:'100%',padding:'12px 14px',background:inputBg,border:`1px solid ${inputBorder}`,borderRadius:10,color:textColor,fontSize:14,outline:'none',boxSizing:'border-box'}}
            />
          </div>
          {mode !== 'forgot' && (
          <div>
            <label style={{fontSize:12,fontWeight:600,color:labelColor,display:'block',marginBottom:6}}>{t('login_password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{width:'100%',padding:'12px 14px',background:inputBg,border:`1px solid ${inputBorder}`,borderRadius:10,color:textColor,fontSize:14,outline:'none',boxSizing:'border-box'}}
            />
            {mode === 'login' && (
              <button type="button" onClick={() => { setMode('forgot'); setError('') }}
                style={{background:'none',border:'none',padding:0,marginTop:8,color:c.accent,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                {t('login_forgot_link')}
              </button>
            )}
          </div>
          )}
        </div>

        {error && (
          <div style={{fontSize:13,padding:'10px 14px',borderRadius:9,marginBottom:16,background: error.startsWith('✅') ? 'color-mix(in srgb, var(--qh-good) 10%, transparent)' : 'color-mix(in srgb, var(--qh-danger) 10%, transparent)',color: error.startsWith('✅') ? 'var(--qh-good)' : '#f87171',border:`1px solid ${error.startsWith('✅') ? 'color-mix(in srgb, var(--qh-good) 20%, transparent)' : 'color-mix(in srgb, var(--qh-danger) 20%, transparent)'}`}}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{width:'100%',padding:'13px',background:BRAND_GRADIENT,color:BRAND_GRADIENT_TEXT_COLOR,fontWeight:700,fontSize:15,borderRadius:11,border:'none',cursor:'pointer',opacity: loading ? .7 : 1}}>
          {loading ? t('login_wait') : mode === 'login' ? t('login_btn_in') : mode === 'signup' ? t('login_btn_up') : t('login_btn_forgot')}
        </button>

        {mode === 'forgot' && (
          <button type="button" onClick={() => { setMode('login'); setError('') }}
            style={{display:'block',margin:'16px auto 0',background:'none',border:'none',color:c.accent,fontSize:13,fontWeight:600,cursor:'pointer'}}>
            {t('login_back_in')}
          </button>
        )}

        <p style={{textAlign:'center',fontSize:12,color:softMuted,marginTop:24,lineHeight:1.7}}>
          {t('login_terms_prefix')}{' '}
          <Link href="/terms" style={{color:c.accent,textDecoration:'none'}}>{t('bc_terms')}</Link>
          {' '}{t('login_terms_and')}{' '}
          <Link href="/privacy" style={{color:c.accent,textDecoration:'none'}}>{t('bc_privacy')}</Link>
        </p>
      </div>
    </div>
  )
}
