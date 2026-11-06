import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/apiGuard'
import { requireAdmin, rpcError, NO_STORE } from '@/lib/admin.server'

// POST /api/admin/plan — { userId, status: 'pro' | 'free', until?: ISO date | null, note?: string }
// Gives or removes Pro by hand. The database checks the admin, the values
// and writes the admin log in the same step.
export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'admin-plan', maxBytes: 4096, perMinute: 30, perHour: 300 })
  if (refused) return refused
  const auth = await requireAdmin()
  if ('refused' in auth) return auth.refused

  let body: { userId?: unknown; status?: unknown; until?: unknown; note?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const userId = typeof body.userId === 'string' && UUID.test(body.userId) ? body.userId : null
  const status = body.status === 'pro' || body.status === 'free' ? body.status : null
  if (!userId || !status) return NextResponse.json({ error: 'userId and status are required.' }, { status: 400 })

  let until: string | null = null
  if (status === 'pro' && body.until != null && body.until !== '') {
    const ms = typeof body.until === 'string' ? Date.parse(body.until) : NaN
    if (!Number.isFinite(ms)) return NextResponse.json({ error: 'Invalid end date.' }, { status: 400 })
    if (ms <= Date.now()) return NextResponse.json({ error: 'The end date must be in the future.' }, { status: 400 })
    until = new Date(ms).toISOString()
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''

  const { error } = await auth.supabase.rpc('admin_set_plan', {
    target: userId,
    new_status: status,
    until,
    note: note || null,
  })
  if (error) return rpcError(error)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
