import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { fitRegression, MAX_PREDICTORS, MAX_ROWS } from '@/lib/regression/model'
import { freeRegressionView } from '@/lib/regression/freeView.server'
import { isProRequest } from '@/lib/pro.server'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/regression — simple and multiple linear regression: QR fit,
// exact tests, ANOVA, VIF, diagnostics, unusual observations, residual
// normality, intervals. The calculation stays on the server; this route
// checks the payload and sends Pro readings to Pro accounts only.
// Body: { yName, xNames: string[], y: number[], X: number[][] (row-wise), predict?: number[] }
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12
const name = (v: unknown) => typeof v === 'string' && v.length >= 1 && v.length <= 60

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'regression', ...CALC_LIMITS })
  if (refused) return refused

  let b: Record<string, unknown>
  try {
    b = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const { yName, xNames, y, X, predict } = b
  const k = Array.isArray(xNames) ? xNames.length : 0
  const ok =
    name(yName) && Array.isArray(xNames) && k >= 1 && k <= MAX_PREDICTORS && xNames.every(name) &&
    new Set(xNames as string[]).size === k &&
    Array.isArray(y) && y.length >= 3 && y.length <= MAX_ROWS && y.every(fin) &&
    Array.isArray(X) && X.length === y.length && X.every(r => Array.isArray(r) && r.length === k && r.every(fin)) &&
    (predict === undefined || predict === null || (Array.isArray(predict) && predict.length === k && predict.every(fin)))
  if (!ok) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const result = fitRegression(yName as string, xNames as string[], y as number[], X as number[][], (predict as number[] | null | undefined) ?? null)
  if ('code' in result) return NextResponse.json({ error: result }, { status: 422 })
  // Free/Pro split: Pro readings go to Pro accounts only (lib/regression/freeView.server.ts)
  const view = (await isProRequest()) ? result : freeRegressionView(result)
  return NextResponse.json({ result: view }, { headers: { 'Cache-Control': 'no-store' } })
}
