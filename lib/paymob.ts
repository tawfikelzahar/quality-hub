import { createHmac, timingSafeEqual } from 'crypto'

// ─────────────────────────────────────────────────────────────────────────
// Paymob (Egypt) — the pure parts: the HMAC check of transaction callbacks.
// No secrets and no network here, so tests/paymob-hmac.test.mjs can run it.
//
// Paymob signs every transaction callback with HMAC-SHA512 over 20 values
// of the transaction, joined in this fixed order with no separator, with
// booleans written as true / false. The result arrives as ?hmac=… .
// (developers.paymob.com → Webhook callbacks and HMAC → HMAC transaction callback)
// ─────────────────────────────────────────────────────────────────────────

export interface PaymobTransaction {
  id?: number | string
  pending?: boolean
  success?: boolean
  amount_cents?: number | string
  created_at?: string
  currency?: string
  error_occured?: boolean
  has_parent_transaction?: boolean
  integration_id?: number | string
  is_3d_secure?: boolean
  is_auth?: boolean
  is_capture?: boolean
  is_refunded?: boolean
  is_standalone_payment?: boolean
  is_voided?: boolean
  is_refund?: boolean
  is_void?: boolean
  owner?: number | string
  order?: { id?: number | string; merchant_order_id?: string | null }
  source_data?: { pan?: string; sub_type?: string; type?: string }
  data?: { message?: string }
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v))

/** The string Paymob signs for a transaction processed callback (POST body's obj). */
export function paymobHmacString(obj: PaymobTransaction): string {
  return [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order?.id,
    obj.owner,
    obj.pending,
    obj.source_data?.pan,
    obj.source_data?.sub_type,
    obj.source_data?.type,
    obj.success,
  ].map(str).join('')
}

/** true when `received` is the HMAC-SHA512 (hex) of the transaction with `secret`. */
export function paymobHmacValid(obj: PaymobTransaction, received: string | null | undefined, secret: string): boolean {
  if (!received || !secret) return false
  const expected = createHmac('sha512', secret).update(paymobHmacString(obj)).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(received.trim().toLowerCase(), 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}
