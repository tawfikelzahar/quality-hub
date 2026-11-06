import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/apiGuard'
import { requireAdmin, rpcError, NO_STORE, type AdminUser } from '@/lib/admin.server'
import { sendWelcomeEmail } from '@/lib/email/welcome'

// POST /api/admin/welcome — { userId, lang: 'ar' | 'en' }
// Sends the welcome email again to one account and records it in the admin log.
export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'admin-welcome', maxBytes: 1024, perMinute: 10, perHour: 60 })
  if (refused) return refused
  const auth = await requireAdmin()
  if ('refused' in auth) return auth.refused
  const { supabase } = auth

  let body: { userId?: unknown; lang?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const userId = typeof body.userId === 'string' && UUID.test(body.userId) ? body.userId : null
  const lang = body.lang === 'en' ? 'en' : 'ar'
  if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 })

  const { data, error } = await supabase.rpc('admin_list_users', { only_id: userId })
  if (error) return rpcError(error)
  const user = ((data ?? []) as AdminUser[])[0]
  if (!user?.email) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  const sent = await sendWelcomeEmail(user.email, user.full_name ?? '', lang)
  if (!sent) return NextResponse.json({ error: 'The email could not be sent. Check RESEND_API_KEY in Vercel.' }, { status: 502 })

  const logged = await supabase.rpc('admin_log_event', { action: 'resend_welcome', target: userId, details: { lang } })
  if (logged.error) console.error('[admin] log failed', logged.error.message)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
