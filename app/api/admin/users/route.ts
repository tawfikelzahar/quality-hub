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

  const [users, log] = await Promise.all([
    supabase.rpc('admin_list_users'),
    supabase.rpc('admin_get_log', { max_rows: 100 }),
  ])
  if (users.error) return rpcError(users.error)
  if (log.error) return rpcError(log.error)

  return NextResponse.json(
    { users: (users.data ?? []) as AdminUser[], log: (log.data ?? []) as AdminLogRow[], now: new Date().toISOString() },
    { headers: NO_STORE },
  )
}
