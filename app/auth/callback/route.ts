import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { data } = await supabase.auth.exchangeCodeForSession(code)
    const user = data?.user
    if (user) {
      // Tell GA (components/Analytics.tsx) whether this was a new account:
      // created within the last 10 minutes = sign_up, otherwise login.
      const created = user.created_at ? Date.parse(user.created_at) : 0
      const provider = (user.app_metadata?.provider as string | undefined) === 'email' ? 'email' : 'google'
      // email sign-ups are counted when the form is sent (app/login), so an
      // email confirmation link coming back here counts as a login
      const isNew = provider === 'google' && created > 0 && Date.now() - created < 10 * 60 * 1000
      const dest = new URL(next, request.url)
      dest.searchParams.set('qh_auth', isNew ? 'sign_up' : 'login')
      dest.searchParams.set('qh_m', provider)
      return NextResponse.redirect(dest)
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}