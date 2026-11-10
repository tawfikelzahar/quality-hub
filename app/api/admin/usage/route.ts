import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, rpcError, NO_STORE } from '@/lib/admin.server'

// GET /api/admin/usage?userId=… — one user's use of Pro features (reports,
// saves, Gage R&R on own data, AI Insights), for the 7-day refund rule.
// Admins only (checked in the database: supabase/sql/011_pro_usage.sql).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AdminUsageRow {
  feature: 'pdf' | 'excel' | 'save' | 'gage' | 'ai'
  tool: string
  uses: number
  first_at: string
  last_at: string
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') ?? ''
  if (!UUID.test(userId)) return NextResponse.json({ error: 'Invalid user.' }, { status: 400 })

  const auth = await requireAdmin()
  if ('refused' in auth) return auth.refused

  const { data, error } = await auth.supabase.rpc('admin_user_usage', { target: userId })
  if (error) {
    if (error.code === 'PGRST202' || /admin_user_usage/.test(error.message)) {
      return NextResponse.json({ error: 'Run supabase/sql/011_pro_usage.sql in Supabase first.' }, { status: 500 })
    }
    return rpcError(error)
  }
  const rows = ((data ?? []) as AdminUsageRow[]).map((r) => ({ ...r, uses: Number(r.uses) }))
  return NextResponse.json({ rows }, { headers: NO_STORE })
}
