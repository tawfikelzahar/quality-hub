import { NextResponse } from 'next/server'
import { requireAdmin, rpcError, NO_STORE } from '@/lib/admin.server'

// GET /api/admin/payments — the latest payment attempts (paid, failed and
// pending), newest first. Admins only (checked in the database:
// supabase/sql/012_payments.sql). Each row also carries the mobile number
// typed at checkout, once supabase/sql/014_payment_phone.sql has been run.
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
  // Mobile numbers come from their own function, so this list keeps working
  // before 014 is run (the numbers are then simply missing).
  const phones = await auth.supabase.rpc('admin_payment_phones')
  const phoneOf = new Map<string, string>()
  if (!phones.error) {
    for (const p of (phones.data ?? []) as { payment_id: string; phone: string }[]) phoneOf.set(p.payment_id, p.phone)
  }
  const rows = ((data ?? []) as { id: string }[]).map((r) => ({ ...r, phone: phoneOf.get(r.id) ?? null }))
  return NextResponse.json({ rows }, { headers: NO_STORE })
}
