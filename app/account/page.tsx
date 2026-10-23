'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { compressAvatar } from '@/lib/avatar'
import ReportBrandingSettings from '@/components/ReportBrandingSettings'
import { usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import AccountStyles from '@/components/AccountStyles'
import { SavedProjectsList, SavedProjectsLocked, SAVED_LIMIT } from '@/components/SavedProjects'
import { useSubscription } from '@/lib/useSubscription'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'
import { getReportBranding, preparedByLine, type ReportBranding } from '@/lib/reportBranding'
import { refreshReportBranding } from '@/lib/reportBrandingLoad'

// ─────────────────────────────────────────────────────────────────────────
// Account page: a header with the person and their plan, a section menu
// (Overview · Saved projects · Report branding · Profile · Security · Plan)
// and one section at a time. Pro features stay visible to free accounts,
// marked PRO, with a faded example and a way to Pro.
// ─────────────────────────────────────────────────────────────────────────

interface AccountUser {
  email: string
  createdAt: string
  isGoogleUser: boolean
  firstName: string
  lastName: string
  avatarUrl: string | null
}

type Section = 'overview' | 'saved' | 'branding' | 'profile' | 'security' | 'plan'
const SECTIONS: Array<{ id: Section; key: TKey; pro?: boolean }> = [
  { id: 'overview', key: 'acc_overview' },
  { id: 'saved', key: 'acc_saved', pro: true },
  { id: 'branding', key: 'acc_branding', pro: true },
  { id: 'profile', key: 'acc_profile' },
  { id: 'security', key: 'acc_security' },
  { id: 'plan', key: 'acc_plan' },
]
const isSection = (v: string): v is Section => SECTIONS.some(s => s.id === v)

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export default function AccountPage() {
  const router = useRouter()
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const { isPro, loading: subLoading } = useSubscription()

  const [user, setUser] = useState<AccountUser | null>(null)
  const [section, setSection] = useState<Section>('overview')
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [branding, setBranding] = useState<ReportBranding | null>(null)

  // Section follows the URL hash (#saved, #branding …) so links can open one
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace('#', '')
      setSection(isSection(h) ? h : 'overview')
    }
    const id = requestAnimationFrame(read)
    window.addEventListener('hashchange', read)
    return () => { cancelAnimationFrame(id); window.removeEventListener('hashchange', read) }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const meta = data.user.user_metadata ?? {}
      setUser({
        email: data.user.email ?? '',
        createdAt: data.user.created_at ?? '',
        isGoogleUser: data.user.app_metadata?.provider === 'google',
        firstName: (meta.first_name as string) ?? '',
        lastName: (meta.last_name as string) ?? '',
        avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || null,
      })
    })
  }, [router])

  // Branding preview on the overview (re-read after the branding section saves)
  useEffect(() => {
    if (!isPro || section !== 'overview') return
    refreshReportBranding().then(() => setBranding(getReportBranding())).catch(() => {})
  }, [isPro, section])

  async function handleSignOut() {
    await createClient().auth.signOut()
    window.location.href = '/'
  }

  const go = (s: Section) => {
    setSection(s)
    history.replaceState(null, '', s === 'overview' ? window.location.pathname : `#${s}`)
  }

  const displayName = user ? (user.firstName ? `${user.firstName} ${user.lastName}`.trim() : user.email) : ''
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div style={{ minHeight: '100vh', background: 'var(--qh-bg)', color: 'var(--qh-text)' }}>
      <AccountStyles />
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_account" />

      <main className="ac-wrap">
        {!user || subLoading ? (
          <div className="ac-muted" style={{ padding: 40 }}>{t('acc_loading')}</div>
        ) : (
          <>
            <section className="ac-card ac-head" aria-label={t('acc_profile')}>
              <div className="ac-person">
                <Avatar url={user.avatarUrl} name={displayName} />
                <div style={{ minWidth: 0 }}>
                  <div className="ac-name">
                    <h1>{displayName}</h1>
                    {isPro ? <span className="ac-pill ac-pill-pro">PRO</span> : <span className="ac-pill ac-pill-free">FREE</span>}
                  </div>
                  <div className="ac-meta">
                    {user.firstName && <>{user.email} · </>}
                    {t('acc_member_since').replace('{d}', memberSince)} · {t(user.isGoogleUser ? 'acc_signed_google' : 'acc_signed_email')}
                  </div>
                </div>
              </div>
              <button type="button" className="ac-btn ac-btn-danger" onClick={handleSignOut}>{t('acc_signout')}</button>
            </section>

            <div className="ac-grid">
              <nav className="ac-nav" aria-label={t('acc_sections')}>
                {SECTIONS.map(s => (
                  <a
                    key={s.id}
                    href={s.id === 'overview' ? '#' : `#${s.id}`}
                    aria-current={section === s.id ? 'page' : undefined}
                    onClick={e => { e.preventDefault(); go(s.id) }}
                  >
                    {t(s.key)}
                    {s.pro && !isPro && <span className="ac-pill ac-pill-pro-o">PRO</span>}
                    {s.id === 'saved' && isPro && savedCount !== null && <span className="ac-count">{savedCount}</span>}
                  </a>
                ))}
              </nav>

              <div className="ac-main">
                {section === 'overview' && (
                  <>
                    <SavedCard isPro={isPro} limit={3} count={savedCount} onCount={setSavedCount} onViewAll={() => go('saved')} />
                    <div className="ac-two">
                      <BrandingCard isPro={isPro} branding={branding} onEdit={() => go('branding')} />
                      <PlanCard isPro={isPro} />
                    </div>
                  </>
                )}
                {section === 'saved' && <SavedCard isPro={isPro} count={savedCount} onCount={setSavedCount} />}
                {section === 'branding' && <ReportBrandingSettings theme={theme} />}
                {section === 'profile' && <ProfileCard user={user} onSaved={u => setUser(prev => (prev ? { ...prev, ...u } : prev))} />}
                {section === 'security' && <SecurityCard isGoogleUser={user.isGoogleUser} />}
                {section === 'plan' && <PlanCard isPro={isPro} />}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Avatar({ url, name, size }: { url: string | null; name: string; size?: number }) {
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.4) } : undefined
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img className="ac-avatar" src={url} alt="" style={style} />
  return <span className="ac-avatar" style={style} aria-hidden="true">{(name || '?').charAt(0).toUpperCase()}</span>
}

function SavedCard({ isPro, limit, count, onCount, onViewAll }: {
  isPro: boolean
  limit?: number
  count: number | null
  onCount: (n: number) => void
  onViewAll?: () => void
}) {
  const { t } = useLanguage()
  return (
    <section className={`ac-card${isPro ? '' : ' ac-card-gold'}`} aria-labelledby="ac-saved-h">
      <div className="ac-card-top">
        <div>
          <div className="ac-title-row">
            <h2 id="ac-saved-h">{t('acc_saved')}</h2>
            {!isPro && <span className="ac-pill ac-pill-pro">PRO</span>}
          </div>
          {isPro && count !== null && (
            <div className="ac-sub">{t('acc_saved_count').replace('{n}', String(count)).replace('50', String(SAVED_LIMIT))}</div>
          )}
        </div>
        {isPro && onViewAll && (
          <button type="button" className="ac-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={onViewAll}>
            {t('acc_view_all')} →
          </button>
        )}
      </div>
      {isPro ? <SavedProjectsList limit={limit} onCount={onCount} /> : <SavedProjectsLocked />}
    </section>
  )
}

function BrandingCard({ isPro, branding, onEdit }: { isPro: boolean; branding: ReportBranding | null; onEdit: () => void }) {
  const { t } = useLanguage()
  const byLine = branding ? preparedByLine(branding) : ''
  return (
    <section className="ac-card" aria-labelledby="ac-brand-h">
      <div className="ac-title-row">
        <h2 id="ac-brand-h">{t(isPro ? 'acc_branding' : 'acc_brand_free_title')}</h2>
        {!isPro && <span className="ac-pill ac-pill-pro-o">PRO</span>}
      </div>
      <div className="ac-sub" style={{ marginBottom: 14 }}>{t(isPro ? 'acc_brand_sub' : 'acc_brand_free_sub')}</div>
      <div className="ac-report" dir="ltr">
        <div className="ac-report-top">
          <span className="ac-report-logo">
            {isPro && branding?.logoDataUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={branding.logoDataUrl} alt="" />
              : isPro && branding?.company ? <strong style={{ color: '#0E1B31' }}>{branding.company}</strong> : '[Your logo]'}
          </span>
          <span style={{ fontSize: 9, color: '#5B6B82' }}>Generated: {new Date().toLocaleDateString('en-GB')}</span>
        </div>
        <div className="ac-report-title">SPC Analysis Report</div>
        <div className="ac-report-by">Prepared by: {isPro && byLine ? byLine : '[Your name] · [Your title]'}</div>
      </div>
      {isPro ? (
        <>
          {!branding && <div className="ac-muted" style={{ marginBottom: 12 }}>{t('acc_brand_none')}</div>}
          <button type="button" className="ac-btn ac-btn-primary" onClick={onEdit}>{t('acc_brand_edit')}</button>
        </>
      ) : (
        <Link href="/sample-reports" className="ac-link">{t('acc_sample_report')} →</Link>
      )}
    </section>
  )
}

function PlanCard({ isPro }: { isPro: boolean }) {
  const { t } = useLanguage()
  const items: TKey[] = isPro
    ? ['acc_pro_b1', 'acc_pro_b2', 'acc_pro_b3', 'acc_pro_b5', 'acc_pro_b4']
    : ['acc_pro_b1', 'acc_pro_b2', 'acc_pro_b3', 'acc_pro_b4']
  return (
    <section className="ac-card" aria-labelledby="ac-plan-h" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="ac-title-row" style={{ justifyContent: 'space-between' }}>
        <h2 id="ac-plan-h">{t('acc_plan')}</h2>
        {isPro && <span className="ac-pill ac-pill-pro">PRO</span>}
      </div>
      <div className="ac-plan-name">{t(isPro ? 'acc_plan_pro' : 'acc_plan_free')}</div>
      <div className="ac-sub">{t(isPro ? 'acc_plan_pro_sub' : 'acc_plan_free_sub')}</div>
      <div className="ac-eyebrow">{t(isPro ? 'acc_pro_includes' : 'acc_pro_adds')}</div>
      <ul className="ac-list" style={{ flex: 1 }}>
        {items.map(k => <li key={k}>{t(k)}</li>)}
      </ul>
      {!isPro && <Link href="/pricing" className="ac-btn ac-btn-gold" style={{ alignSelf: 'flex-start' }}>{t('acc_see_pro')}</Link>}
    </section>
  )
}

function ProfileCard({ user, onSaved }: { user: AccountUser; onSaved: (u: Partial<AccountUser>) => void }) {
  const { t } = useLanguage()
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function pick(file: File | null) {
    if (!file) { setAvatarFile(null); setAvatarPreview(null); return }
    if (!file.type.startsWith('image/')) { setMsg({ ok: false, text: t('acc_err_image') }); return }
    if (file.size > MAX_AVATAR_BYTES) { setMsg({ ok: false, text: t('acc_err_image_size') }); return }
    setMsg(null)
    const compressed = await compressAvatar(file)
    setAvatarFile(compressed)
    setAvatarPreview(URL.createObjectURL(compressed))
  }

  async function save() {
    if (!firstName.trim() || !lastName.trim()) { setMsg({ ok: false, text: t('acc_err_name_empty') }); return }
    setLoading(true)
    setMsg(null)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    let avatarUrl = user.avatarUrl
    if (avatarFile && userId) {
      const path = `${userId}/avatar-${Date.now()}.${avatarFile.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
      if (uploadError) { setMsg({ ok: false, text: uploadError.message }); setLoading(false); return }
      avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    }
    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        avatar_url: avatarUrl,
      },
    })
    setLoading(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    onSaved({ firstName: firstName.trim(), lastName: lastName.trim(), avatarUrl })
    setAvatarFile(null)
    setAvatarPreview(null)
    setMsg({ ok: true, text: t('acc_msg_profile_ok') })
  }

  return (
    <section className="ac-card" aria-labelledby="ac-profile-h">
      <h2 id="ac-profile-h" style={{ marginBottom: 16 }}>{t('acc_profile')}</h2>
      <div className="ac-form">
        <div className="ac-photo">
          <Avatar url={avatarPreview ?? user.avatarUrl} name={firstName || user.email} size={48} />
          <label className="ac-btn" style={{ cursor: 'pointer' }}>
            {avatarFile ? t('acc_change_photo') : t('acc_upload_photo')}
            <input type="file" accept="image/*" onChange={e => pick(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
          </label>
        </div>
        <div className="ac-fields">
          <label><span className="ac-label">{t('acc_first')}</span>
            <input className="ac-input" value={firstName} onChange={e => setFirstName(e.target.value)} /></label>
          <label><span className="ac-label">{t('acc_last')}</span>
            <input className="ac-input" value={lastName} onChange={e => setLastName(e.target.value)} /></label>
        </div>
        {msg && <div className={msg.ok ? 'ac-msg-ok' : 'ac-msg-err'}>{msg.text}</div>}
        <button type="button" className="ac-btn ac-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={loading}>
          {loading ? t('acc_saving') : t('acc_save_profile')}
        </button>
      </div>
    </section>
  )
}

function SecurityCard({ isGoogleUser }: { isGoogleUser: boolean }) {
  const { t } = useLanguage()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function change() {
    setMsg(null)
    if (pw.length < 6) { setMsg({ ok: false, text: t('acc_err_pw_short') }); return }
    if (pw !== pw2) { setMsg({ ok: false, text: t('acc_err_pw_match') }); return }
    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password: pw })
    setLoading(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    setMsg({ ok: true, text: t('acc_msg_pw_ok') })
    setPw('')
    setPw2('')
  }

  return (
    <section className="ac-card" aria-labelledby="ac-sec-h">
      <h2 id="ac-sec-h" style={{ marginBottom: 16 }}>{t('acc_security')}</h2>
      {isGoogleUser ? (
        <p className="ac-lead" style={{ color: 'var(--qh-muted)' }}>{t('acc_google_nopw')}</p>
      ) : (
        <div className="ac-form">
          <label><span className="ac-label">{t('acc_new_pw')}</span>
            <input className="ac-input" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" /></label>
          <label><span className="ac-label">{t('acc_confirm_pw')}</span>
            <input className="ac-input" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="••••••••" /></label>
          {msg && <div className={msg.ok ? 'ac-msg-ok' : 'ac-msg-err'}>{msg.text}</div>}
          <button type="button" className="ac-btn ac-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={change} disabled={loading}>
            {loading ? t('acc_updating') : t('acc_update_pw')}
          </button>
        </div>
      )}
    </section>
  )
}
