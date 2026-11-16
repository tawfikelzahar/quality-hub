import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/apiGuard'
import { createServerSupabase } from '@/lib/supabase-server'
import { SITE } from '@/lib/site'
import type { PeriodId } from '@/lib/pricing'
import { createIntention, checkoutUrl } from '@/lib/paymob.server'
import { attachIntention, checkoutContext, createPayment, quote, savePaymentPhone, userGetsFounding, visitorCountry } from '@/lib/payments.server'

// POST /api/paymob/checkout — starts a Pro payment for the signed-in user
// and returns the address of Paymob's payment page. The amount comes from
// lib/pricing.ts and the visitor's country, never from the request.
export const runtime = 'nodejs'

const PLANS: PeriodId[] = ['monthly', 'quarterly', 'yearly']
const PERIOD_NAME: Record<PeriodId, string> = { monthly: '1 month', quarterly: '3 months', yearly: '1 year' }

export async function POST(request: NextRequest) {
  const refused = guardApi(request, { bucket: 'paymob-checkout', maxBytes: 2048, perMinute: 6, perHour: 30 })
  if (refused) return refused

  let body: { plan?: unknown; phone?: unknown; lang?: unknown; as?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.', code: 'input' }, { status: 400 })
  }
  const planId = PLANS.find((p) => p === body.plan)
  const phone = typeof body.phone === 'string' ? body.phone.replace(/[\s()-]/g, '') : ''
  const lang = body.lang === 'en' ? 'en' : 'ar'
  if (!planId) return NextResponse.json({ error: 'Choose a plan.', code: 'input' }, { status: 400 })
  if (!/^\+?\d{8,15}$/.test(phone)) return NextResponse.json({ error: 'Enter a valid mobile number.', code: 'phone' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'Please sign in.', code: 'login' }, { status: 401 })

  // ?as= country preview, honoured for the admin only
  const country = await visitorCountry(request.headers.get('x-vercel-ip-country'), body.as, supabase)
  const ctx = await checkoutContext(country, supabase)
  if (ctx.state !== 'open' || !ctx.cfg) {
    return NextResponse.json({ error: 'Checkout is not open yet.', code: ctx.state }, { status: 403 })
  }

  const q = quote(ctx.region, planId, await userGetsFounding(supabase, user.id))
  if (!q) return NextResponse.json({ error: 'This plan is not available.', code: 'input' }, { status: 400 })

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const full = String(meta.full_name || meta.name || '').trim()
  const [first, ...rest] = (full || user.email.split('@')[0]).split(/\s+/)

  try {
    const paymentId = await createPayment({ userId: user.id, lang, region: ctx.region, country, quote: q, mode: ctx.cfg.mode })
    await savePaymentPhone(paymentId, phone)
    const intention = await createIntention(ctx.cfg, {
      amountCents: q.amountCents,
      currency: q.currency,
      itemName: `${SITE.name} Pro - ${PERIOD_NAME[planId]}`,
      itemDescription: `${SITE.name} Pro for ${PERIOD_NAME[planId]}, one-time payment, no automatic renewal`,
      reference: paymentId,
      customer: { firstName: (first || 'NA').slice(0, 50), lastName: (rest.join(' ') || 'NA').slice(0, 50), email: user.email, phone },
      lang,
    })
    await attachIntention(paymentId, intention.intentionId, intention.orderId)
    return NextResponse.json({ url: checkoutUrl(ctx.cfg, intention.clientSecret) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[paymob] checkout failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not start the payment.', code: 'provider' }, { status: 502 })
  }
}
