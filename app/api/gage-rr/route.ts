import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { createServerSupabase } from '@/lib/supabase-server'
import { buildGageDiagnosis, type GageResultForDiagnosis } from '@/lib/gage/diagnosis.server'
import { runGageRR, runAnovaGageRR, type GageInput } from '@/lib/gage/calc.server'
import { isGageSampleInput } from '@/lib/gage/sample'

// POST /api/gage-rr — Pro, except the page's sample study (open example).
// Calculations: lib/gage/calc.server.ts


export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'gage-rr', ...CALC_LIMITS })
  if (refused) return refused

  let body: GageInput & { method?: 'average-range' | 'anova'; poolingAlpha?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }
  if (!body || !Array.isArray(body.measurements) || !Array.isArray(body.appraiserNames)) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  // Open example: anyone can analyse the page's sample study (both methods).
  // Any other data is Pro — checked here too, never only in the UI.
  const sample = isGageSampleInput(body.measurements, body.USL, body.LSL) &&
    body.numTrials === 3 && body.numParts === 10 && body.appraiserNames.length === 3
  if (!sample) {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single()
    if (profile?.subscription_status !== 'pro') {
      return NextResponse.json({ error: 'Gage R&R is a Pro feature.', code: 'pro' }, { status: 403 })
    }
  }

  try {
    const result = body.method === 'anova'
      ? runAnovaGageRR(body, body.poolingAlpha ?? 0.05)
      : runGageRR(body)
    const method = body.method === 'anova' ? 'anova' : 'average-range'
    // Report interpretation, written on the server from the numbers above
    const diagnosis = buildGageDiagnosis({ method, ...result } as GageResultForDiagnosis)
    return NextResponse.json({ method, ...result, diagnosis })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Calculation error: ' + message }, { status: 400 })
  }
}
