import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { evaluateIcmsf } from '@/lib/icmsf/calculator'
import { HAZARD_LEVEL_ORDER, CONDITION_EFFECT_ORDER, MAX_RESULT, type IcmsfRequest } from '@/lib/icmsf/options'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/icmsf — ICMSF Case (Table 6-1), unit classes and lot decision,
// plus the 2-class OC curve. Table 6-1 and the formulas stay on the server;
// this route only checks the payload, lib/icmsf/calculator.ts does the work.
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_RESULT
const numOrNull = (v: unknown) => v === null || num(v)

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'icmsf', ...CALC_LIMITS })
  if (refused) return refused

  let b: Record<string, unknown>
  try {
    b = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const ok =
    HAZARD_LEVEL_ORDER.includes(b.hazard as never) &&
    CONDITION_EFFECT_ORDER.includes(b.condition as never) &&
    (b.mode === 'presence' || b.mode === 'count') &&
    numOrNull(b.m) && numOrNull(b.M) &&
    (b.positives === null || (typeof b.positives === 'number' && Number.isInteger(b.positives) && b.positives >= 0 && b.positives <= 60)) &&
    Array.isArray(b.results) && b.results.length <= 60 && b.results.every(numOrNull) &&
    typeof b.riskP === 'number' && b.riskP >= 0 && b.riskP <= 100
  if (!ok) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const result = evaluateIcmsf(b as unknown as IcmsfRequest)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
