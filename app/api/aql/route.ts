import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { evaluateStage } from '@/lib/aql/calculator'
import { AQL_OPTIONS, LEVELS, TYPES, MAX_LOT_SIZE, MAX_STAGES, MAX_CLASSES, type AqlStageRequest } from '@/lib/aql/options'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/aql — AQL single sampling plans (ISO 2859-1:2026 Tables 1–4)
// and the accept / not accept decision for what was found. The verified
// tables stay on the server; the page sends the stages and draws the reply.
// This route only checks the payload; lib/aql/calculator.ts does the work.
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const isInt = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

function parseStage(v: unknown): AqlStageRequest | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  // lot size: any whole number up to the limit; below 2 comes back as error 'lot'
  if (!isInt(o.lotSize, 0, MAX_LOT_SIZE)) return null
  if (!LEVELS.includes(o.level as never) || !TYPES.includes(o.inspectionType as never)) return null
  if (!Array.isArray(o.classes) || o.classes.length > MAX_CLASSES) return null
  const classes: AqlStageRequest['classes'] = []
  for (const c of o.classes) {
    if (!c || typeof c !== 'object') return null
    const { aql, found } = c as Record<string, unknown>
    if (!AQL_OPTIONS.includes(aql as never)) return null
    if (found !== null && !isInt(found, 0, MAX_LOT_SIZE)) return null
    classes.push({ aql: aql as number, found: found as number | null })
  }
  return { lotSize: o.lotSize as number, level: o.level as AqlStageRequest['level'], inspectionType: o.inspectionType as AqlStageRequest['inspectionType'], classes }
}

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'aql', ...CALC_LIMITS })
  if (refused) return refused

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const list = (body as { stages?: unknown })?.stages
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_STAGES) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const stages: AqlStageRequest[] = []
  for (const s of list) {
    const parsed = parseStage(s)
    if (!parsed) return NextResponse.json({ error: 'invalid' }, { status: 400 })
    stages.push(parsed)
  }
  return NextResponse.json({ stages: stages.map(evaluateStage) }, { headers: { 'Cache-Control': 'no-store' } })
}
