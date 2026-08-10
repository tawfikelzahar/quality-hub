import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { computeDescriptiveStats } from '@/lib/descriptive/stats'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { values?: unknown }
    if (!body || !Array.isArray(body.values)) {
      return NextResponse.json({ error: 'Invalid payload: expected { values: number[] }.' }, { status: 400 })
    }

    const values = body.values
      .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
      .filter((v) => Number.isFinite(v))

    if (values.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 valid numeric values.' }, { status: 400 })
    }

    const result = computeDescriptiveStats(values)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Calculation error: ' + message }, { status: 400 })
  }
}
