import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { analyzeStability, type StabilityInput } from '@/lib/stability/calc'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/stability — ICH Q1E shelf life: model choice (α 0.25), the
// confidence bound and the shelf life per batch. The calculation stays on
// the server; this route only checks the payload.
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const MAX_BATCHES = 20
const MAX_POINTS = 200
const fin = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'stability', ...CALC_LIMITS })
  if (refused) return refused

  let b: Record<string, unknown>
  try {
    b = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const batches = b.batches
  const ok =
    Array.isArray(batches) && batches.length >= 1 && batches.length <= MAX_BATCHES &&
    batches.every(x => x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string' &&
      Array.isArray((x as { points?: unknown }).points) && ((x as { points: unknown[] }).points).length <= MAX_POINTS &&
      ((x as { points: unknown[] }).points).every(p => p && typeof p === 'object' && fin((p as { time?: unknown }).time) && (p as { time: number }).time >= 0 && fin((p as { value?: unknown }).value))) &&
    (b.lower === null || fin(b.lower)) && (b.upper === null || fin(b.upper)) &&
    typeof b.confidence === 'number' && [0.9, 0.95, 0.99].includes(b.confidence)
  if (!ok) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (b.lower !== null && b.upper !== null && (b.lower as number) >= (b.upper as number)) {
    return NextResponse.json({ error: 'limits' }, { status: 400 })
  }

  const result = analyzeStability(b as unknown as StabilityInput)
  return NextResponse.json({ result }, { headers: { 'Cache-Control': 'no-store' } })
}
