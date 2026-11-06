import 'server-only'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'

// ─────────────────────────────────────────────────────────────────────────
// Admin dashboard (/admin) helpers. Every admin check happens in the
// database (supabase/sql/010_admin_dashboard.sql): is_admin() and each
// admin_* function refuse anyone whose confirmed email is not in the
// admins table. This file only turns that into HTTP answers. No service
// role key is used anywhere.
// ─────────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  provider: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  subscription_status: 'free' | 'pro'
  pro_until: string | null
  welcome_sent_at: string | null
}

export interface AdminLogRow {
  id: number
  created_at: string
  admin_email: string
  action: string
  target_user_id: string | null
  target_email: string | null
  details: Record<string, unknown>
}

/** true only for a signed-in admin; any failure counts as not admin. */
export async function isAdminSession(supabase?: SupabaseClient): Promise<boolean> {
  try {
    const sb = supabase ?? await createServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return false
    const { data, error } = await sb.rpc('is_admin')
    return !error && data === true
  } catch {
    return false
  }
}

/** The Supabase client for an admin request, or the response to send back. */
export async function requireAdmin(): Promise<{ supabase: SupabaseClient } | { refused: NextResponse }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { refused: NextResponse.json({ error: 'Please sign in.' }, { status: 401 }) }
  if (!(await isAdminSession(supabase))) {
    return { refused: NextResponse.json({ error: 'Not found.' }, { status: 404 }) }
  }
  return { supabase }
}

/** Database error → HTTP answer (42501 = not admin, 22023 = bad input, P0002 = no such user). */
export function rpcError(error: { code?: string; message: string }): NextResponse {
  if (error.code === '42501') return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  if (error.code === '22023') return NextResponse.json({ error: error.message }, { status: 400 })
  if (error.code === 'P0002') return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  console.error('[admin] database error', error.code, error.message)
  return NextResponse.json({ error: 'Database error. Has supabase/sql/010_admin_dashboard.sql been run?' }, { status: 500 })
}

export const NO_STORE = { 'Cache-Control': 'no-store' }
