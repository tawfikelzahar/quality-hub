import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { analyzeFactorial } from '@/lib/doe/calculator'
import { MAX_FACTORS, MAX_REPLICATES, MIN_FACTORS, type FactorDef } from '@/lib/doe/design'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/doe — 2^k full factorial: effects, ANOVA or Lenth's method,
// coefficients, factorial-plot means and the uncoded equation. The
// analysis stays on the server; this route only checks the payload.
// Body: { factors: [{ name, low, high, unit? }], responses: number[][] }
// (responses[p] = replicate values at design point p, standard order)
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'doe', ...CALC_LIMITS })
  if (refused) return refused

  let b: Record<string, unknown>
  try {
    b = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const factors = b.factors
  const responses = b.responses
  const ok =
    Array.isArray(factors) && factors.length >= MIN_FACTORS && factors.length <= MAX_FACTORS &&
    factors.every(f => f && typeof f === 'object' && text((f as FactorDef).name, 40) && fin((f as FactorDef).low) && fin((f as FactorDef).high) &&
      ((f as FactorDef).unit === undefined || text((f as FactorDef).unit, 20))) &&
    Array.isArray(responses) && responses.length === 2 ** factors.length &&
    responses.every(r => Array.isArray(r) && r.length >= 1 && r.length <= MAX_REPLICATES && r.every(fin))
  if (!ok) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const clean = (factors as FactorDef[]).map(f => ({ name: f.name, low: f.low, high: f.high, ...(f.unit ? { unit: f.unit } : {}) }))
  const result = analyzeFactorial(clean, responses as number[][])
  if (typeof result === 'string') return NextResponse.json({ error: result }, { status: 422 })
  return NextResponse.json({ result }, { headers: { 'Cache-Control': 'no-store' } })
}
