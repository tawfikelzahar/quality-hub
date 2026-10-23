import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { createServerSupabase } from '@/lib/supabase-server'
import { buildReportText, type ReportTextInput } from '@/lib/spc/reportText.server'
import { wireReviver } from '@/lib/spc/wire'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/spc/report-text — the interpretation blocks of the SPC PDF
// report (Capability Diagnosis, Recommended Action, Study Conclusion and the
// page-1 Summary). Pro only, checked here on the server.
// The page sends the same inputs it used to pass to the functions itself.
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const MAX_SIGNALS = 5000
const TIERS = new Set(['low', 'moderate', 'adequate'])

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const isNumOrNull = (v: unknown) => v === null || isNum(v)
const isStrOrNull = (v: unknown, max = 200) => v === null || (typeof v === 'string' && v.length <= max)

function validSignals(v: unknown): boolean {
  return Array.isArray(v) && v.length <= MAX_SIGNALS &&
    v.every(s => !!s && typeof s === 'object' && isNum((s as { rule: unknown }).rule) && typeof (s as { dispersionChart: unknown }).dispersionChart === 'boolean')
}

function validCapability(c: unknown): boolean {
  if (c === null) return true
  if (!c || typeof c !== 'object') return false
  const o = c as Record<string, unknown>
  return isNumOrNull(o.LSL) && isNumOrNull(o.USL) && isNumOrNull(o.target) &&
    isNum(o.center) && isNum(o.mu) && typeof o.sigmaWithin === 'number' && typeof o.sdOverall === 'number' &&
    typeof o.normal === 'boolean' && validSignals(o.signals) && isNum(o.n) && TIERS.has(o.adequacyTier as string)
}

function validConclusion(c: unknown): boolean {
  if (c === null) return true
  if (!c || typeof c !== 'object') return false
  const o = c as Record<string, unknown>
  const attr = o.attribute
  const attrOk = attr === undefined || attr === null ||
    (typeof attr === 'object' && isStrOrNull((attr as Record<string, unknown>).chartLabel) && isStrOrNull((attr as Record<string, unknown>).metricText))
  return isStrOrNull(o.classLabel) && (o.indexName === null || o.indexName === 'Cpk' || o.indexName === 'Ppk') &&
    isNumOrNull(o.indexValue) && isNumOrNull(o.ppk) && isNumOrNull(o.ppmOverall) && isStrOrNull(o.yieldText) &&
    typeof o.normal === 'boolean' && validSignals(o.signals) && isNum(o.n) && TIERS.has(o.adequacyTier as string) && attrOk
}

function validSummary(c: unknown): boolean {
  if (c === null) return true
  if (!c || typeof c !== 'object') return false
  const o = c as Record<string, unknown>
  return validSignals(o.signals) && isStrOrNull(o.capabilityText) && typeof o.noSpecs === 'boolean' &&
    isNum(o.n) && TIERS.has(o.adequacyTier as string) && (o.unit === 'readings' || o.unit === 'subgroups')
}

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'spc-report-text', ...CALC_LIMITS })
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
    return NextResponse.json({ error: 'The full report is a Pro feature.', code: 'pro' }, { status: 403 })
  }

  let body: unknown
  try {
    body = JSON.parse(await request.text(), wireReviver)
  } catch {
    return NextResponse.json({ error: 'Invalid payload.', code: 'invalid' }, { status: 400 })
  }
  const o = (body ?? {}) as Record<string, unknown>
  const input = { capability: o.capability ?? null, conclusion: o.conclusion ?? null, summary: o.summary ?? null }
  if (!validCapability(input.capability) || !validConclusion(input.conclusion) || !validSummary(input.summary)) {
    return NextResponse.json({ error: 'Invalid payload.', code: 'invalid' }, { status: 400 })
  }

  try {
    const text = buildReportText(input as ReportTextInput)
    return NextResponse.json(text, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not build the report text.', code: 'server' }, { status: 500 })
  }
}
