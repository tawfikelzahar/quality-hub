'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n/context'
import { useSubscription } from '@/lib/useSubscription'

interface AuthDisplay {
  email: string
  displayName: string
  avatarUrl: string | null
}

// Reads Google's fields (full_name/name, avatar_url/picture) and falls back
// to our own first_name/last_name (set at email/password signup) and finally
// to the email itself, so this works no matter how the person signed in.
function buildDisplay(user: {
  email?: string | null
  user_metadata?: Record<string, unknown>
}): AuthDisplay {
  const meta = user.user_metadata ?? {}
  const email = user.email ?? ''

  const fullName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim()

  const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || null

  return {
    email,
    displayName: fullName || email,
    avatarUrl,
  }
}

export default function AuthStatus() {
  const [user, setUser] = useState<AuthDisplay | null>(null)
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()
  const { isPro, loading: planLoading } = useSubscription()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? buildDisplay(data.user) : null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? buildDisplay(session.user) : null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return <span style={{ width: 60, display: 'inline-block' }} />
  }

  if (!user) {
    return (
      <Link href="/login" style={{ fontSize: 13, color: 'var(--qh-muted)', textDecoration: 'none', fontWeight: 500 }}>
        {t('nav_signin')}
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {!planLoading && (
        <Link
          href="/account#saved"
          className="qh-hide-mobile"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--qh-muted)', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {t('acc_saved')}
          {!isPro && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--qh-gold)', border: '1px solid color-mix(in srgb, var(--qh-gold) 55%, transparent)', borderRadius: 4, padding: '1px 5px' }}>PRO</span>
          )}
        </Link>
      )}
      <Link
        href="/account"
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--qh-muted)', textDecoration: 'none', fontWeight: 500 }}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            width={26}
            height={26}
            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--qh-accent)',
              color: 'var(--qh-onAccent)',
              fontWeight: 800,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        {user.displayName}
      </Link>
      <button
        onClick={handleSignOut}
        style={{ fontSize: 12, color: 'var(--qh-muted)', background: 'transparent', border: '1px solid var(--qh-border)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}
      >
        {t('nav_signout')}
      </button>
    </div>
  )
}
