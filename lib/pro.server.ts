import 'server-only'
import { createServerSupabase } from '@/lib/supabase-server'
import { DEV_PRO } from '@/lib/devPro'

// ─────────────────────────────────────────────────────────────────────────
// Is the person calling this API route a Pro subscriber? For routes that are
// open to everyone but send Pro readings only to Pro accounts (the free/Pro
// split of 1 Nov 2026). Visitors and free accounts get false; any Supabase
// failure counts as not Pro.
// ─────────────────────────────────────────────────────────────────────────

export async function isProRequest(): Promise<boolean> {
  return (await proAccess()) === 'pro'
}

/**
 * For Pro-only routes: 'pro' → go ahead · 'free' → 403 code 'pro' ·
 * 'login' → 401 code 'login'. Any Supabase failure counts as 'login'.
 * The local test switch (lib/devPro.ts) gives 'pro'; it is always off in
 * deployed builds.
 */
export async function proAccess(): Promise<'pro' | 'free' | 'login'> {
  if (DEV_PRO) return 'pro'
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'login'
    const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
    return profile?.subscription_status === 'pro' ? 'pro' : 'free'
  } catch {
    return 'login'
  }
}
