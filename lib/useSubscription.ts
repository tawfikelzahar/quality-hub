'use client'

import { useAuthState, type SubscriptionStatus } from '@/lib/authState'
import { DEV_PRO } from '@/lib/devPro'

export type { SubscriptionStatus }

interface UseSubscriptionResult {
  status: SubscriptionStatus
  isPro: boolean
  // بيفرق بين "زائر مش مسجل خالص" و"مسجل بس على الخطة المجانية" — الأدوات
  // بقت متاحة للزوار من غير تسجيل، بس CSV/PNG export بيحتاج تسجيل دخول
  // (مش لازم Pro) عشان نجمع الإيميلات، والـ Excel/PDF/Save فضلوا Pro بس.
  isLoggedIn: boolean
  loading: boolean
}

// حالة الاشتراك بتاعة المستخدم الحالي. بتتقري مرة واحدة للصفحة كلها من
// lib/authState.ts (مش لكل مكون لوحده). لو مش مسجل أو مفيش صف في profiles
// بترجع 'free' (افتراضيًا مقفول). السيرفر هو اللي بيتأكد من Pro فعلًا.
export function useSubscription(): UseSubscriptionResult {
  const { status, user, loading } = useAuthState()
  // Local test switch (lib/devPro.ts) — always false in deployed builds
  if (DEV_PRO) return { status: 'pro', isPro: true, isLoggedIn: true, loading: false }
  return { status, isPro: status === 'pro', isLoggedIn: !!user, loading }
}
