'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export type SubscriptionStatus = 'free' | 'pro'

interface UseSubscriptionResult {
  status: SubscriptionStatus
  isPro: boolean
  // بيفرق بين "زائر مش مسجل خالص" و"مسجل بس على الخطة المجانية" — الأدوات
  // بقت متاحة للزوار من غير تسجيل، بس CSV/PNG export بيحتاج تسجيل دخول
  // (مش لازم Pro) عشان نجمع الإيميلات، والـ Excel/PDF/Save فضلوا Pro بس.
  isLoggedIn: boolean
  loading: boolean
}

// بيقرا حالة الاشتراك بتاعة المستخدم الحالي من جدول profiles.
// لو مش مسجل دخول، أو الجدول لسه معملوش backfill له لأي سبب، بيرجع 'free'
// كـ fallback آمن (منطق "افتراضيًا مقفول" أفضل من "افتراضيًا مفتوح").
export function useSubscription(): UseSubscriptionResult {
  const [status, setStatus] = useState<SubscriptionStatus>('free')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (active) {
          setStatus('free')
          setIsLoggedIn(false)
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
        setIsLoggedIn(true)
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

  return { status, isPro: status === 'pro', isLoggedIn, loading }
}
