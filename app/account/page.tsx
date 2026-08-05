'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { compressAvatar } from '@/lib/avatar'
import { COLORS, getSharedStyles, usePersistedTheme, type ThemeMode } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'

interface AccountUser {
  email: string
  createdAt: string
  isGoogleUser: boolean
  firstName: string
  lastName: string
  avatarUrl: string | null
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export default function AccountPage() {
  const router = useRouter()
  const [theme, setTheme] = usePersistedTheme()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  const [user, setUser] = useState<AccountUser | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMessage, setPwMessage] = useState('')

  // Profile (name + photo) editing state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      const meta = data.user.user_metadata ?? {}
      const loadedFirstName = (meta.first_name as string) ?? ''
      const loadedLastName = (meta.last_name as string) ?? ''
      setUser({
        email: data.user.email ?? '',
        createdAt: data.user.created_at ?? '',
        isGoogleUser: data.user.app_metadata?.provider === 'google',
        firstName: loadedFirstName,
        lastName: loadedLastName,
        avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || null,
      })
      setFirstName(loadedFirstName)
      setLastName(loadedLastName)
      setLoadingUser(false)
    })
  }, [router])

  async function handleAvatarChange(file: File | null) {
    if (!file) { setAvatarFile(null); setAvatarPreview(null); return }
    if (!file.type.startsWith('image/')) { setProfileMessage('❌ Please choose an image file.'); return }
    if (file.size > MAX_AVATAR_BYTES) { setProfileMessage('❌ Image must be under 5MB.'); return }
    setProfileMessage('')
    const compressed = await compressAvatar(file)
    setAvatarFile(compressed)
    setAvatarPreview(URL.createObjectURL(compressed))
  }

  async function handleSaveProfile() {
    if (!firstName.trim() || !lastName.trim()) {
      setProfileMessage('❌ First and last name can\u2019t be empty.')
      return
    }
    setProfileLoading(true)
    setProfileMessage('')
    const supabase = createClient()

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    let avatarUrl = user?.avatarUrl ?? null

    if (avatarFile && userId) {
      const path = `${userId}/avatar-${Date.now()}.${avatarFile.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true })
      if (uploadError) {
        setProfileMessage(`❌ ${uploadError.message}`)
        setProfileLoading(false)
        return
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      avatarUrl = urlData.publicUrl
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        avatar_url: avatarUrl,
      },
    })

    setProfileLoading(false)
    if (error) {
      setProfileMessage(`❌ ${error.message}`)
      return
    }
    setUser(prev => prev ? { ...prev, firstName: firstName.trim(), lastName: lastName.trim(), avatarUrl } : prev)
    setAvatarFile(null)
    setAvatarPreview(null)
    setProfileMessage('✅ Profile updated successfully.')
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  async function handleChangePassword() {
    setPwMessage('')
    if (newPassword.length < 6) {
      setPwMessage('❌ Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('❌ Passwords do not match.')
      return
    }
    setPwLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)
    if (error) {
      setPwMessage(`❌ ${error.message}`)
      return
    }
    setPwMessage('✅ Password updated successfully.')
    setNewPassword('')
    setConfirmPassword('')
  }

  const cardStyle = { ...s.card, maxWidth: 560, width: '100%' }
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div style={s.page}>
      <nav className="qh-nav" style={s.nav}>
        <div className="qh-nav-left" style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span className="qh-breadcrumb-sep" style={s.separator}>/</span>
          <span className="qh-breadcrumb" style={s.breadcrumb}>Account</span>
        </div>
        <div className="qh-nav-right" style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <AuthStatus />
        </div>
      </nav>

      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        {loadingUser || !user ? (
          <div style={{ color: c.muted, padding: 40 }}>Loading...</div>
        ) : (
          <>
            {/* Profile header card */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.firstName || user.email}
                    width={56}
                    height={56}
                    style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${c.accent}, ${c.accent2})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      fontWeight: 800,
                      color: '#060d1a',
                      flexShrink: 0,
                    }}
                  >
                    {(user.firstName || user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>
                    {user.firstName ? `${user.firstName} ${user.lastName}` : user.email}
                  </div>
                  {user.firstName && (
                    <div style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{user.email}</div>
                  )}
                  <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>
                    Member since {memberSince} · Signed in with {user.isGoogleUser ? 'Google' : 'Email'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  fontSize: 13,
                  color: c.danger,
                  background: 'transparent',
                  border: `1px solid ${c.danger}40`,
                  borderRadius: 8,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Sign Out
              </button>
            </div>

            {/* Edit profile card — name + photo, works for Google and email accounts alike */}
            <div style={cardStyle}>
              <div style={s.sectionTitle}>Profile</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {avatarPreview || user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview ?? user.avatarUrl ?? undefined}
                      alt="Avatar"
                      width={48}
                      height={48}
                      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: c.surface2, border: `1px dashed ${c.border}`, flexShrink: 0 }} />
                  )}
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.accent, cursor: 'pointer', padding: '8px 14px', border: `1px solid ${c.accent}60`, borderRadius: 8 }}>
                    {avatarFile ? 'Change photo' : 'Upload photo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={s.label}>First Name</div>
                    <input
                      type="text"
                      style={s.input}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.label}>Last Name</div>
                    <input
                      type="text"
                      style={s.input}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                {profileMessage && (
                  <div style={{ fontSize: 12, color: profileMessage.startsWith('✅') ? '#4ade80' : c.danger }}>
                    {profileMessage}
                  </div>
                )}
                <button
                  onClick={handleSaveProfile}
                  disabled={profileLoading}
                  style={{ ...s.exportBtn, background: c.accent, color: '#060d1a', width: 'fit-content', padding: '9px 20px' }}
                >
                  {profileLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>

            {/* Security card */}
            <div style={cardStyle}>
              <div style={s.sectionTitle}>Security</div>
              {user.isGoogleUser ? (
                <p style={{ fontSize: 13, color: c.muted, margin: 0 }}>
                  You sign in with your Google account, so there&apos;s no password to manage here.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={s.label}>New Password</div>
                    <input
                      type="password"
                      style={s.input}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <div style={s.label}>Confirm New Password</div>
                    <input
                      type="password"
                      style={s.input}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  {pwMessage && (
                    <div style={{ fontSize: 12, color: pwMessage.startsWith('✅') ? '#4ade80' : c.danger }}>
                      {pwMessage}
                    </div>
                  )}
                  <button
                    onClick={handleChangePassword}
                    disabled={pwLoading}
                    style={{ ...s.exportBtn, background: c.accent, color: '#060d1a', width: 'fit-content', padding: '9px 20px' }}
                  >
                    {pwLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              )}
            </div>

            {/* Plan card — extension point for future subscriptions (Lemon Squeezy) */}
            <div style={cardStyle}>
              <div style={s.sectionTitle}>Plan</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Free Plan</div>
                  <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>Full access to all tools</div>
                </div>
                <span style={{ ...s.badge, background: `${c.accent}20`, color: c.accent }}>Active</span>
              </div>
              <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: c.text, lineHeight: 1.9 }}>
                <li>SPC Engine</li>
                <li>Pareto Chart</li>
                <li>DPMO &amp; Sigma Calculator</li>
                <li>AQL Sampling Plan Calculator</li>
              </ul>
              <button
                disabled
                style={{
                  ...s.exportBtn,
                  cursor: 'not-allowed',
                  opacity: 0.5,
                  width: 'fit-content',
                  padding: '9px 20px',
                }}
              >
                Upgrade to Pro — Coming Soon
              </button>
            </div>

            <Link
              href="/dashboard"
              style={{ fontSize: 13, color: c.accent, textDecoration: 'none', fontWeight: 600 }}
            >
              المشاريع المحفوظة (Pro) →
            </Link>
          </>
        )}
      </main>
    </div>
  )
}