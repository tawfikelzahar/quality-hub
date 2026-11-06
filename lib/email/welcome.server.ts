import type { SupabaseClient, User } from '@supabase/supabase-js'
import { sendWelcomeEmail } from './welcome'

// Sends the welcome email once per account. The flag lives in the user's
// own metadata (welcome_sent_at), written with the user's session, so no
// table or service key is needed. Accounts older than 7 days never get it,
// so existing users are not suddenly welcomed when they next sign in.
const NEW_ACCOUNT_DAYS = 7

export async function maybeSendWelcome(supabase: SupabaseClient, user: User, lang: 'ar' | 'en'): Promise<void> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  if (meta.welcome_sent_at) return
  if (!user.email) return
  const created = user.created_at ? Date.parse(user.created_at) : 0
  if (!created || Date.now() - created > NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000) return
  // email accounts get it only after the address is confirmed
  if (!user.email_confirmed_at && !user.confirmed_at) return

  const name = String(meta.full_name || meta.name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || '').trim()
  const sent = await sendWelcomeEmail(user.email, name, lang)
  if (sent) await supabase.auth.updateUser({ data: { welcome_sent_at: new Date().toISOString() } })
}
