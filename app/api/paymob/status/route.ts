import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET /api/paymob/status — the signed-in user's payment from the last
// 2 hours (a paid one if there is one, else the latest), read with their own session (they can read only their own
// rows). The page shown after paying polls this until the callback lands.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ status: 'login' }, { status: 401 })

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('payments')
    .select('id, status, plan, months, pro_until, created_at, amount_cents, currency, founding, mode')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) return NextResponse.json({ status: 'error' }, { status: 500 })
  // A paid attempt wins over a later abandoned one (two tabs, a retry).
  const row = data?.find((r) => r.status === 'paid') ?? data?.[0]
  return NextResponse.json(
    row
      ? {
          status: row.status, plan: row.plan, months: row.months, proUntil: row.pro_until,
          // for the GA4 purchase event on the result page (the user's own payment)
          id: row.id, amount: row.amount_cents / 100, currency: row.currency, founding: row.founding, mode: row.mode,
        }
      : { status: 'none' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
