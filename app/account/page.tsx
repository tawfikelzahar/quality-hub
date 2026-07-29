'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { COLORS, getSharedStyles, type ThemeMode } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'

interface AccountUser {
  email: string
  createdAt: string
  isGoogleUser: boolean
}

export default function AccountPage() {
  const router = useRouter()
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const c = COLORS[theme]
  const s = getSharedStyles(theme)

  const [user, setUser] = useState<AccountUser | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMessage, setPwMessage] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUser({
        email: data.user.email ?? '',
        createdAt: data.user.created_at ?? '',
        isGoogleUser: data.user.app_metadata?.provider === 'google',
      })
      setLoadingUser(false)
    })
  }, [router])

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
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span style={s.separator}>/</span>
          <span style={s.breadcrumb}>Account</span>
        </div>
        <div style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <AuthStatus />
        </div>
      </nav>

      <main style={{ ...s.main, alignItems: 'center' }}>
        {loadingUser || !user ? (
          <div style={{ color: c.muted, padding: 40 }}>Loading...</div>
        ) : (
          <>
            {/* Profile card */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
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
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{user.email}</div>
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
          </>
        )}
      </main>
    </div>
  )
}