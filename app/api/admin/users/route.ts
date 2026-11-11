import { NextResponse } from 'next/server'
import { requireAdmin, rpcError, NO_STORE, type AdminUser, type AdminLogRow } from '@/lib/admin.server'

// GET /api/admin/users — every account with its plan, plus the latest admin
// actions. Admins only (checked in the database).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdmin()
  if ('refused' in auth) return auth.refused
  const { supabase } = auth

  const [users, log, prices] = await Promise.all([
    supabase.rpc('admin_list_users'),
    supabase.rpc('admin_get_log', { max_rows: 100 }),
    supabase.rpc('admin_user_prices'),
  ])
  if (users.error) return rpcError(users.error)
  if (log.error) return rpcError(log.error)

  // Price type of each subscriber's last paid payment (supabase/sql/013). If
  // 013 has not been run yet the list still loads, just without prices.
  const priceOf = new Map<string, 'founding' | 'regular'>()
  if (!prices.error) {
    for (const p of (prices.data ?? []) as { user_id: string; founding: boolean }[]) {
      priceOf.set(p.user_id, p.founding ? 'founding' : 'regular')
    }
  }
  const list = ((users.data ?? []) as AdminUser[]).map((u) => ({ ...u, price: priceOf.get(u.id) ?? null }))

  return NextResponse.json(
    { users: list, log: (log.data ?? []) as AdminLogRow[], now: new Date().toISOString() },
    { headers: NO_STORE },
  )
}
