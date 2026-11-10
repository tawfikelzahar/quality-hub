import { NextRequest, NextResponse, after } from 'next/server'
import { paymobHmacValid, type PaymobTransaction } from '@/lib/paymob'
import { paymobConfig } from '@/lib/paymob.server'
import { confirmPayment } from '@/lib/payments.server'
import { sendPaymentEmail } from '@/lib/email/payment'

// POST /api/paymob/callback — Paymob's "transaction processed" callback, the
// only thing that turns a payment into Pro. The browser redirect after
// paying is never trusted (Paymob's own advice).
//
//   1. the HMAC signature must be valid (lib/paymob.ts), else 401
//   2. order.merchant_order_id is our payment id (special_reference)
//   3. payments_confirm checks the amount and currency, marks the payment
//      paid and starts or extends Pro; a repeated callback changes nothing
//   4. a newly paid payment gets a confirmation email
// Refund and void callbacks are acknowledged and logged; Pro is removed by
// hand from /admin when a refund is given.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const num = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function POST(request: NextRequest) {
  const cfg = paymobConfig()
  if (!cfg) return NextResponse.json({ ok: false }, { status: 503 })

  let body: { type?: string; obj?: PaymobTransaction }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const obj = body?.obj
  if (!obj || typeof obj !== 'object') return NextResponse.json({ ok: false }, { status: 400 })

  if (!paymobHmacValid(obj, request.nextUrl.searchParams.get('hmac'), cfg.hmacSecret)) {
    console.warn('[paymob] callback with a bad signature refused')
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // Signed and from Paymob from here on: always answer 200 so it is not re-sent forever.
  if (body.type !== 'TRANSACTION') return NextResponse.json({ ok: true, ignored: 'type' })
  if (obj.is_refund || obj.is_void || obj.is_refunded || obj.is_voided) {
    console.warn('[paymob] refund/void callback', obj.id, obj.order?.merchant_order_id)
    return NextResponse.json({ ok: true, ignored: 'refund' })
  }

  const paymentId = String(obj.order?.merchant_order_id ?? '')
  if (!UUID.test(paymentId)) {
    console.warn('[paymob] callback without our payment id', obj.id)
    return NextResponse.json({ ok: true, ignored: 'reference' })
  }

  try {
    const r = await confirmPayment({
      id: paymentId,
      txn: num(obj.id),
      order: num(obj.order?.id),
      success: obj.success === true,
      pending: obj.pending === true,
      amountCents: num(obj.amount_cents),
      currency: typeof obj.currency === 'string' ? obj.currency : null,
      reason: typeof obj.data?.message === 'string' ? obj.data.message : null,
    })
    if (r.result === 'mismatch' || r.result === 'not_found') {
      console.error('[paymob] callback not applied', r.result, paymentId, obj.id)
    }
    if (r.result === 'paid' && r.email) {
      after(() => sendPaymentEmail(r.email!, r.name ?? '', {
        lang: r.lang === 'en' ? 'en' : 'ar',
        months: r.months ?? 1,
        amountCents: r.amount_cents ?? 0,
        currency: r.currency ?? 'EGP',
        proUntil: r.pro_until ?? null,
        reference: String(obj.id ?? ''),
      }))
    }
    return NextResponse.json({ ok: true, result: r.result })
  } catch (err) {
    // Database trouble: answer 500 so Paymob sends the callback again.
    console.error('[paymob] callback failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
