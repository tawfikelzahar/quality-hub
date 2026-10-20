import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  AI_DAILY_LIMIT,
  InsightError,
  callClaude,
  parseInsightRequest,
} from '@/lib/ai/insight'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/ai-insight — Pro-only AI interpretation of an analysis result.
//
// Order of checks (every one runs on the server, never trusted from the UI):
//   1. Logged in?                       → 401
//   2. profiles.subscription_status = 'pro'?  → 403
//   3. Valid numeric payload?           → 400
//   4. Under the daily limit?           → 429
//   5. Call Claude, then record usage (failed calls are NOT counted).
// ─────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'AI Insights is a Pro feature.', code: 'pro' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload.', code: 'invalid' }, { status: 400 })
  }
  const parsed = parseInsightRequest(body)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid payload.', code: 'invalid' }, { status: 400 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabase
    .from('ai_insight_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if (countError) {
    // Fail closed: without a working usage table there is no rate limit.
    console.error('[ai-insight] usage count failed', countError.message)
    return NextResponse.json({ error: 'AI usage tracking is unavailable.', code: 'server' }, { status: 500 })
  }
  const used = count ?? 0
  if (used >= AI_DAILY_LIMIT) {
    return NextResponse.json(
      { error: 'Daily AI limit reached.', code: 'limit', limit: AI_DAILY_LIMIT, remaining: 0 },
      { status: 429 },
    )
  }

  try {
    const result = await callClaude(parsed)
    const { error: insertError } = await supabase.from('ai_insight_usage').insert({
      user_id: user.id,
      tool: parsed.tool,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
    })
    if (insertError) console.error('[ai-insight] usage insert failed', insertError.message)

    return NextResponse.json({
      text: result.text,
      limit: AI_DAILY_LIMIT,
      remaining: Math.max(0, AI_DAILY_LIMIT - used - 1),
    })
  } catch (err: unknown) {
    if (err instanceof InsightError) {
      return NextResponse.json(
        { error: err.message, code: err.status === 503 ? 'not_configured' : 'upstream' },
        { status: err.status },
      )
    }
    console.error('[ai-insight] unexpected error', err)
    return NextResponse.json({ error: 'Unexpected error.', code: 'server' }, { status: 500 })
  }
}
