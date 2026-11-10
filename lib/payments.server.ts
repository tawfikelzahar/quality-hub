import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { FOUNDING, PRICES, regionForCountry, type PeriodId, type PlanPrice, type Region } from '@/lib/pricing'
import { paymobConfig, type PaymobConfig } from '@/lib/paymob.server'
import { isAdminSession } from '@/lib/admin.server'
import { isProRow } from '@/lib/plan'

// ─────────────────────────────────────────────────────────────────────────
// Paying for Pro — the rules, in one place (server only):
//
//   • The price is always worked out here from lib/pricing.ts and the
//     visitor's country (x-vercel-ip-country). Nothing the browser sends
//     can change the amount.
//   • Checkout is OPEN only when: the Paymob keys and PAYMENTS_DB_SECRET are
//     set, the visitor is on the Egyptian price list (the card integration
//     is in EGP), and either the keys are live or the visitor is the admin.
//     With test keys the public sees "opens soon", so nobody can get Pro
//     with a Paymob test card.
//   • Payment rows are written only through the payments_* database
//     functions, which need PAYMENTS_DB_SECRET
//     (supabase/sql/012_payments.sql). No service role key is used.
// ─────────────────────────────────────────────────────────────────────────

export type CheckoutState = 'open' | 'soon' | 'region'

export interface CheckoutContext {
  state: CheckoutState
  region: Region
  country: string | null
  mode: 'test' | 'live' | 'off'
  cfg: PaymobConfig | null
}

function dbSecret(): string {
  return (process.env.PAYMENTS_DB_SECRET ?? '').trim()
}

/** Is checkout open for this request? `supabase` is the signed-in user's client (for the admin check). */
export async function checkoutContext(country: string | null, supabase?: SupabaseClient): Promise<CheckoutContext> {
  const region = regionForCountry(country)
  const cfg = paymobConfig()
  const base = { region, country, cfg, mode: cfg ? cfg.mode : 'off' as const }
  if (!cfg || !dbSecret()) return { ...base, state: 'soon' }
  if (region !== 'eg') return { ...base, state: 'region' }
  if (cfg.mode === 'test' && !(await isAdminSession(supabase))) return { ...base, state: 'soon' }
  return { ...base, state: 'open' }
}

/** Is the founding price open to everyone right now? */
export function foundingOpen(now: number = Date.now()): boolean {
  if (!FOUNDING.open) return false
  if (!FOUNDING.endsAt) return true
  const end = Date.parse(FOUNDING.endsAt)
  return Number.isFinite(end) && now < end
}

/**
 * Does this user pay the founding price? Yes while it is open to everyone;
 * after it closes, only someone who paid a founding price before and whose
 * Pro has not lapsed (the promise on the pricing page).
 */
export async function userGetsFounding(supabase: SupabaseClient, userId: string): Promise<boolean> {
  if (foundingOpen()) return true
  try {
    const [{ data: profile }, { data: past }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('payments').select('id').eq('user_id', userId).eq('status', 'paid').eq('founding', true).limit(1),
    ])
    return isProRow(profile) && !!profile?.pro_until && (past?.length ?? 0) > 0
  } catch {
    return false
  }
}

export interface Quote {
  plan: PlanPrice
  currency: 'EGP' | 'USD'
  founding: boolean
  amount: number
  amountCents: number
}

export function quote(region: Region, planId: PeriodId, founding: boolean): Quote | null {
  const list = PRICES[region]
  const plan = list.plans.find((p) => p.id === planId)
  if (!plan) return null
  const amount = founding ? plan.founding : plan.price
  return { plan, currency: list.currency, founding, amount, amountCents: Math.round(amount * 100) }
}

// ── Database (payments_* functions, guarded by PAYMENTS_DB_SECRET) ───────

let anon: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!anon) {
    anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return anon
}

export async function createPayment(p: {
  userId: string; lang: 'ar' | 'en'; region: Region; country: string | null
  quote: Quote; mode: 'test' | 'live'
}): Promise<string> {
  const { data, error } = await db().rpc('payments_create', {
    secret: dbSecret(),
    p_user: p.userId,
    p_lang: p.lang,
    p_region: p.region,
    p_country: p.country,
    p_plan: p.quote.plan.id,
    p_months: p.quote.plan.months,
    p_amount_cents: p.quote.amountCents,
    p_currency: p.quote.currency,
    p_founding: p.quote.founding,
    p_mode: p.mode,
  })
  if (error || typeof data !== 'string') throw new Error(`payments_create failed: ${error?.code ?? ''} ${error?.message ?? 'no id'}`)
  return data
}

export async function attachIntention(id: string, intentionId: string | null, orderId: number | null): Promise<void> {
  const { error } = await db().rpc('payments_attach', { secret: dbSecret(), p_id: id, p_intention: intentionId, p_order: orderId })
  if (error) console.error('[payments] attach failed', error.code, error.message)
}

export interface ConfirmResult {
  result: 'paid' | 'already' | 'failed' | 'pending' | 'mismatch' | 'not_found'
  email?: string | null
  name?: string | null
  lang?: 'ar' | 'en'
  plan?: PeriodId
  months?: number
  amount_cents?: number
  currency?: 'EGP' | 'USD'
  pro_until?: string | null
}

export async function confirmPayment(p: {
  id: string; txn: number | null; order: number | null; success: boolean; pending: boolean
  amountCents: number | null; currency: string | null; reason: string | null
}): Promise<ConfirmResult> {
  const { data, error } = await db().rpc('payments_confirm', {
    secret: dbSecret(),
    p_id: p.id,
    p_txn: p.txn,
    p_order: p.order,
    p_success: p.success,
    p_pending: p.pending,
    p_amount_cents: p.amountCents,
    p_currency: p.currency,
    p_reason: p.reason,
  })
  if (error) throw new Error(`payments_confirm failed: ${error.code} ${error.message}`)
  return (data ?? { result: 'not_found' }) as ConfirmResult
}
