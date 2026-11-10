import { NextResponse } from 'next/server'
import { requireAdmin, rpcError, NO_STORE } from '@/lib/admin.server'

// GET /api/admin/payments — the latest payment attempts (paid, failed and
// pending), newest first. Admins only (checked in the database:
// supabase/sql/012_payments.sql).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdmin()
  if ('refused' in auth) return auth.refused
  const { data, error } = await auth.supabase.rpc('admin_list_payments', { max_rows: 200 })
  if (error) {
    if (error.code === 'PGRST202' || /admin_list_payments/.test(error.message)) {
      return NextResponse.json({ error: 'Run supabase/sql/012_payments.sql in Supabase first.' }, { status: 500 })
    }
    return rpcError(error)
  }
  return NextResponse.json({ rows: data ?? [] }, { headers: NO_STORE })
}
