'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export type SubscriptionStatus = 'free' | 'pro'

interface UseSubscriptionResult {
  status: SubscriptionStatus
  isPro: boolean
  loading: boolean
}

// بيقرا حالة الاشتراك بتاعة المستخدم الحالي من جدول profiles.
// لو مش مسجل دخول، أو الجدول لسه معملوش backfill له لأي سبب، بيرجع 'free'
// كـ fallback آمن (منطق "افتراضيًا مقفول" أفضل من "افتراضيًا مفتوح").
export function useSubscription(): UseSubscriptionResult {
  const [status, setStatus] = useState<SubscriptionStatus>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (active) {
          setStatus('free')
          setLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single()

      if (active) {
        const value = (data?.subscription_status as SubscriptionStatus | undefined) ?? 'free'
        setStatus(error ? 'free' : value)
        setLoading(false)
      }
    }

    load()

    const { data: listener } = supabase.auth.onAuthStateChange(() => load())
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return { status, isPro: status === 'pro', loading }
}
