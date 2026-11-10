import 'server-only'
import { SITE } from '@/lib/site'

// ─────────────────────────────────────────────────────────────────────────
// Paymob (Egypt) — server side. Keys live only in Vercel:
//   PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY, PAYMOB_HMAC_SECRET,
//   PAYMOB_INTEGRATION_ID_CARD, PAYMOB_INTEGRATION_ID_WALLET (optional)
//
// Flow (Intention API + Unified Checkout):
//   1. createIntention() with the amount → client_secret
//   2. the customer pays on Paymob's page (checkoutUrl())
//   3. Paymob POSTs the result to /api/paymob/callback, signed with HMAC
// Test and live use the same address; the keys decide the mode.
// ─────────────────────────────────────────────────────────────────────────

const BASE = 'https://accept.paymob.com'

export interface PaymobConfig {
  secretKey: string
  publicKey: string
  hmacSecret: string
  cardId: number
  walletId: number | null
  mode: 'test' | 'live'
}

function intEnv(name: string): number | null {
  const n = Number((process.env[name] ?? '').trim())
  return Number.isInteger(n) && n > 0 ? n : null
}

/** The Paymob settings, or null when a required key is missing. */
export function paymobConfig(): PaymobConfig | null {
  const secretKey = (process.env.PAYMOB_SECRET_KEY ?? '').trim()
  const publicKey = (process.env.PAYMOB_PUBLIC_KEY ?? '').trim()
  const hmacSecret = (process.env.PAYMOB_HMAC_SECRET ?? '').trim()
  const cardId = intEnv('PAYMOB_INTEGRATION_ID_CARD')
  if (!secretKey || !publicKey || !hmacSecret || !cardId) return null
  // Live only when both keys say so; anything else is treated as test, which
  // keeps checkout closed to the public (see lib/payments.server.ts).
  const live = /_live_/i.test(secretKey) && /_live_/i.test(publicKey)
  return { secretKey, publicKey, hmacSecret, cardId, walletId: intEnv('PAYMOB_INTEGRATION_ID_WALLET'), mode: live ? 'live' : 'test' }
}

export interface IntentionInput {
  amountCents: number
  currency: 'EGP' | 'USD'
  itemName: string
  itemDescription: string
  /** our payment id; comes back in callbacks as order.merchant_order_id */
  reference: string
  customer: { firstName: string; lastName: string; email: string; phone: string }
  /** language of the page the customer returns to */
  lang: 'ar' | 'en'
}

export interface Intention {
  clientSecret: string
  intentionId: string | null
  orderId: number | null
}

/** Creates the payment intention. Throws with Paymob's answer when it is refused. */
export async function createIntention(cfg: PaymobConfig, input: IntentionInput): Promise<Intention> {
  const methods = [cfg.cardId, ...(cfg.walletId ? [cfg.walletId] : [])]
  const c = input.customer
  const body = {
    amount: input.amountCents,
    currency: input.currency,
    payment_methods: methods,
    items: [{ name: input.itemName, amount: input.amountCents, description: input.itemDescription, quantity: 1 }],
    billing_data: {
      first_name: c.firstName, last_name: c.lastName, email: c.email, phone_number: c.phone,
      apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA', shipping_method: 'NA',
      postal_code: 'NA', city: 'NA', country: 'EG', state: 'NA',
    },
    customer: { first_name: c.firstName, last_name: c.lastName, email: c.email },
    special_reference: input.reference,
    extras: { payment_id: input.reference },
    notification_url: `${SITE.url}/api/paymob/callback`,
    redirection_url: `${SITE.url}${input.lang === 'ar' ? '/ar' : ''}/checkout/result`,
  }
  const res = await fetch(`${BASE}/v1/intention/`, {
    method: 'POST',
    headers: { Authorization: `Token ${cfg.secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try { json = JSON.parse(text) as Record<string, unknown> } catch { /* not JSON */ }
  const clientSecret = typeof json.client_secret === 'string' ? json.client_secret : ''
  if (!res.ok || !clientSecret) {
    throw new Error(`Paymob intention refused (${res.status}): ${text.slice(0, 500)}`)
  }
  const orderId = Number(json.intention_order_id)
  return {
    clientSecret,
    intentionId: typeof json.id === 'string' ? json.id : null,
    orderId: Number.isFinite(orderId) && orderId > 0 ? orderId : null,
  }
}

/** Paymob's hosted payment page for an intention. */
export function checkoutUrl(cfg: PaymobConfig, clientSecret: string): string {
  return `${BASE}/unifiedcheckout/?publicKey=${encodeURIComponent(cfg.publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`
}
