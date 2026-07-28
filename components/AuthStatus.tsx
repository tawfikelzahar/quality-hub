'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
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

  if (!email) {
    return (
      <Link href="/login" style={{ fontSize: 13, color: '#6b89b4', textDecoration: 'none', fontWeight: 500 }}>
        Sign In
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Link href="/account" style={{ fontSize: 13, color: '#8fafd4', textDecoration: 'none', fontWeight: 500 }}>
        {email}
      </Link>
      <button
        onClick={handleSignOut}
        style={{ fontSize: 12, color: '#6b89b4', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}
      >
        Sign Out
      </button>
    </div>
  )
}