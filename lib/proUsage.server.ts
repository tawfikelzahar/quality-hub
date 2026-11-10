import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'

// Server side of the Pro usage log (supabase/sql/011_pro_usage.sql).
// Inserts with the signed-in user's own session (RLS: own rows only).
// Never throws: logging must not break the feature it records.

export type ProFeature = 'pdf' | 'excel' | 'save' | 'gage'

// Gage R&R recalculates on every edit (debounced), so one study would add a
// row per pause. One gage row per user per 30 minutes is enough for the
// refund check. Kept in this server instance's memory, like lib/apiGuard.ts.
const GAGE_EVERY_MS = 30 * 60 * 1000
const lastGage = new Map<string, number>()

function gageThrottled(uid: string): boolean {
  const now = Date.now()
  const last = lastGage.get(uid)
  if (last !== undefined && now - last < GAGE_EVERY_MS) return true
  if (lastGage.size > 5000) lastGage.clear()
  lastGage.set(uid, now)
  return false
}

export async function recordProUsage(feature: ProFeature, tool: string, supabase?: SupabaseClient, userId?: string): Promise<void> {
  try {
    const sb = supabase ?? await createServerSupabase()
    let uid = userId
    if (!uid) {
      const { data: { user } } = await sb.auth.getUser()
      uid = user?.id
    }
    if (!uid) return
    if (feature === 'gage' && gageThrottled(uid)) return
    const { error } = await sb.from('pro_usage').insert({ user_id: uid, feature, tool: (tool || 'unknown').slice(0, 80) })
    if (error) console.error('[pro-usage] insert failed', error.code, error.message)
  } catch (err) {
    console.error('[pro-usage] failed', err instanceof Error ? err.message : err)
  }
}
