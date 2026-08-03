import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// بنستخدم الفانكشن دي جوه API routes (route.ts) عشان نتأكد إن المستخدم
// عامل تسجيل دخول فعلاً قبل ما نرجّعله نتيجة أي حساب.
// الـ middleware بيحمي الصفحات بس، مش الـ API routes، فلازم نتأكد هنا كمان.
export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // ممكن نحصل هنا لو تم استدعاء الفانكشن من مكان مش قادر يعدل الكوكيز
            // (زي بعض الحالات في Server Components) — نتجاهلها بأمان.
          }
        },
      },
    }
  )
}
