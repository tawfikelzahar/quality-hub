import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/apiGuard'
import { createServerSupabase } from '@/lib/supabase-server'
import { recordProUsage } from '@/lib/proUsage.server'

// POST /api/pro-usage — the browser reports a PDF or Excel report download
// (lib/proUsage.ts). Only for signed-in users; recorded under their own id.
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'pro-usage', maxBytes: 1024, perMinute: 30, perHour: 300 })
  if (refused) return refused

  let body: { feature?: unknown; tool?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const feature = body.feature === 'pdf' || body.feature === 'excel' ? body.feature : null
  const tool = typeof body.tool === 'string' ? body.tool.trim().slice(0, 80) : ''
  if (!feature || !tool) return NextResponse.json({ ok: false }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  await recordProUsage(feature, tool, supabase, user.id)
  return NextResponse.json({ ok: true })
}
