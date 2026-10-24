import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { createServerSupabase } from '@/lib/supabase-server'
import { buildOEEInsight } from '@/lib/oee/insight.server'
import type { OEEInputs } from '@/lib/oee/calc'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/oee/insight — the "What to work on first" card of the OEE tool.
// Pro only, checked here on the server. The page sends the six inputs; the
// server recomputes with lib/oee/calc.ts and writes the advice.
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const FIELDS: (keyof OEEInputs)[] = ['plannedTime', 'breaks', 'downtime', 'cycleTime', 'totalCount', 'goodCount']
const MAX = 1e9

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'oee-insight', ...CALC_LIMITS })
  if (refused) return refused

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.', code: 'login' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()
  if (profile?.subscription_status !== 'pro') {
    return NextResponse.json({ error: 'This card is a Pro feature.', code: 'pro' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: 'Invalid payload.', code: 'invalid' }, { status: 400 })
  }
  const ok = FIELDS.every(f => typeof body[f] === 'number' && Number.isFinite(body[f]) && (body[f] as number) >= 0 && (body[f] as number) <= MAX)
  if (!ok) return NextResponse.json({ error: 'Invalid payload.', code: 'invalid' }, { status: 400 })

  const inputs = Object.fromEntries(FIELDS.map(f => [f, body[f]])) as unknown as OEEInputs
  const insight = buildOEEInsight(inputs)
  if (!insight) return NextResponse.json({ error: 'Invalid inputs.', code: 'invalid' }, { status: 400 })
  return NextResponse.json(insight, { headers: { 'Cache-Control': 'no-store' } })
}
