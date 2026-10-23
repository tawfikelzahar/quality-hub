import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { runVariableChartAnalysis, runXbarSAnalysis } from '@/lib/spc/engine.server'
import { wireReplacer } from '@/lib/spc/wire'
import { screenReason } from '@/lib/spc/reportText.server'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/spc/chart — I-MR, X̄-R and X̄-S calculations, run on the server
// so the calculator never ships to the browser.
//
// Same calculator, same inputs and same defaults the pages used when they
// computed in the browser (sigmaConvention 'direct', default test set).
// This route only checks the payload; it computes nothing of its own.
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const MAX_VALUES = 20000
const MAX_ROWS = 5000
const MAX_SUBGROUP = 50

type Chart = 'imr' | 'xbar-r' | 'xbar-s'

function bad(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status })
}

function optionalNumber(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'spc-chart', ...CALC_LIMITS })
  if (refused) return refused

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return bad('invalid')
  }
  if (!body || typeof body !== 'object') return bad('invalid')
  const { chart, data, LSL, USL, target } = body as Record<string, unknown>

  if (chart !== 'imr' && chart !== 'xbar-r' && chart !== 'xbar-s') return bad('invalid')
  if (!Array.isArray(data) || data.length > MAX_ROWS) return bad('invalid')

  let total = 0
  for (const row of data) {
    if (!Array.isArray(row) || row.length === 0 || row.length > MAX_SUBGROUP) return bad('invalid')
    for (const v of row) if (typeof v !== 'number' || !Number.isFinite(v)) return bad('invalid')
    total += row.length
  }
  if (total > MAX_VALUES) return bad('too-large', 413)
  if (data.length < 3) return bad('insufficient-data')

  const rows = data as number[][]
  const N = rows[0].length
  if (rows.some(r => r.length !== N)) return bad('inconsistent-subgroups')
  if ((chart as Chart) === 'imr' ? N !== 1 : N < 2) return bad('invalid')

  const lsl = optionalNumber(LSL), usl = optionalNumber(USL), tgt = optionalNumber(target)
  if (lsl === undefined || usl === undefined || tgt === undefined) return bad('invalid')

  const input = { data: rows, N, LSL: lsl, USL: usl, target: tgt, sigmaConvention: 'direct' }
  try {
    const result = chart === 'xbar-s' ? runXbarSAnalysis(input) : runVariableChartAnalysis(input)
    const reason = screenReason(result, tgt)
    return new NextResponse(JSON.stringify({ result, reason }, wireReplacer), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch {
    return bad('calc', 500)
  }
}
