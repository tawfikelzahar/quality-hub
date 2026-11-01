import 'server-only'
import { createServerSupabase } from '@/lib/supabase-server'

// ─────────────────────────────────────────────────────────────────────────
// Is the person calling this API route a Pro subscriber? For routes that are
// open to everyone but send Pro readings only to Pro accounts (the free/Pro
// split of 1 Nov 2026). Visitors and free accounts get false; any Supabase
// failure counts as not Pro.
// ─────────────────────────────────────────────────────────────────────────

export async function isProRequest(): Promise<boolean> {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
    return profile?.subscription_status === 'pro'
  } catch {
    return false
  }
}
