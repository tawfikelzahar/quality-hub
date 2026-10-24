import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { createServerSupabase } from '@/lib/supabase-server'
import { evaluateRisk } from '@/lib/icmsf/calculator'
import { HAZARD_LEVEL_ORDER, CONDITION_EFFECT_ORDER, MAX_RESULT, type IcmsfRiskRequest } from '@/lib/icmsf/options'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/icmsf/risk — probability of acceptance against the lot mean
// concentration (lognormal, FAO/WHO FOSTAT model) for 3-class plans and
// 2-class plans with a count limit. Pro only, checked here on the server.
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_RESULT

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'icmsf-risk', ...CALC_LIMITS })
  if (refused) return refused

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized. Please log in.', code: 'login' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
  if (profile?.subscription_status !== 'pro') {
    return NextResponse.json({ error: 'This analysis is a Pro feature.', code: 'pro' }, { status: 403 })
  }

  let b: Record<string, unknown>
  try {
    b = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: 'invalid', code: 'invalid' }, { status: 400 })
  }
  const ok =
    HAZARD_LEVEL_ORDER.includes(b.hazard as never) &&
    CONDITION_EFFECT_ORDER.includes(b.condition as never) &&
    pos(b.m) && (b.M === null || pos(b.M)) &&
    typeof b.sd === 'number' && b.sd >= 0.05 && b.sd <= 3 &&
    typeof b.point === 'number' && Number.isFinite(b.point) && Math.abs(b.point) <= 20
  if (!ok) return NextResponse.json({ error: 'invalid', code: 'invalid' }, { status: 400 })

  const result = evaluateRisk(b as unknown as IcmsfRiskRequest)
  if (!result) return NextResponse.json({ error: 'limits', code: 'limits' }, { status: 400 })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
