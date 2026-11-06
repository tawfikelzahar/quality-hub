import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/apiGuard'
import { createServerSupabase } from '@/lib/supabase-server'
import { maybeSendWelcome } from '@/lib/email/welcome.server'
import { LANG_COOKIE } from '@/lib/i18n/routing'

// POST /api/welcome — called by the login page after an email + password
// sign-in, for accounts confirmed in another browser (those skip
// /auth/callback). Only ever emails the signed-in user, at most once.
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'welcome', maxBytes: 1024, perMinute: 5, perHour: 20 })
  if (refused) return refused
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  const lang = request.cookies.get(LANG_COOKIE)?.value === 'ar' ? 'ar' : 'en'
  await maybeSendWelcome(supabase, user, lang)
  return NextResponse.json({ ok: true })
}
