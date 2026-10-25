import { NextRequest, NextResponse } from 'next/server'
import { guardApi, CALC_LIMITS } from '@/lib/apiGuard'
import { createServerSupabase } from '@/lib/supabase-server'
import { buildGageDiagnosis, type GageResultForDiagnosis } from '@/lib/gage/diagnosis.server'
import { runGageRR, runAnovaGageRR, type GageInput } from '@/lib/gage/calc.server'

// POST /api/gage-rr — Pro only. Calculations: lib/gage/calc.server.ts


export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'gage-rr', ...CALC_LIMITS })
  if (refused) return refused

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  // Gage R&R is a Pro tool: check the plan here too, never only in the UI.
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()
  if (profile?.subscription_status !== 'pro') {
    return NextResponse.json({ error: 'Gage R&R is a Pro feature.', code: 'pro' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as GageInput & { method?: 'average-range' | 'anova'; poolingAlpha?: number }
    if (!body || !Array.isArray(body.measurements) || !Array.isArray(body.appraiserNames)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }
    const result = body.method === 'anova'
      ? runAnovaGageRR(body, body.poolingAlpha ?? 0.25)
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
