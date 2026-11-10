// Paymob callback HMAC: the signed string must match the worked example in
// Paymob's docs (Webhook callbacks and HMAC → HMAC transaction callback),
// and a wrong signature, secret or changed amount must be refused.
import { createHmac } from 'node:crypto'
import { paymobHmacString, paymobHmacValid, type PaymobTransaction } from '../../../lib/paymob.ts'

const DOC_STRING = '1000002024-06-13T11:33:44.592345EGPfalsefalse1920364654097558truefalsefalsefalsetruefalse217503754302852false2346MasterCardcardtrue'

const sample: PaymobTransaction = {
  id: 192036465,
  pending: false,
  amount_cents: 100000,
  success: true,
  is_auth: false,
  is_capture: false,
  is_standalone_payment: true,
  is_voided: false,
  is_refunded: false,
  is_3d_secure: true,
  integration_id: 4097558,
  has_parent_transaction: false,
  order: { id: 217503754, merchant_order_id: 'abc' },
  created_at: '2024-06-13T11:33:44.592345',
  currency: 'EGP',
  error_occured: false,
  owner: 302852,
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
}

let pass = 0
let fail = 0
const check = (name: string, ok: boolean) => { if (ok) pass++; else { fail++; console.log(`✗ ${name}`) } }

check('signed string matches the Paymob docs example', paymobHmacString(sample) === DOC_STRING)

const secret = 'test-secret-123'
const good = createHmac('sha512', secret).update(DOC_STRING).digest('hex')
check('valid signature accepted', paymobHmacValid(sample, good, secret))
check('uppercase signature accepted', paymobHmacValid(sample, good.toUpperCase(), secret))
check('wrong secret refused', !paymobHmacValid(sample, good, 'other-secret'))
check('changed amount refused', !paymobHmacValid({ ...sample, amount_cents: 100 }, good, secret))
check('changed success refused', !paymobHmacValid({ ...sample, success: false }, createHmac('sha512', secret).update(DOC_STRING).digest('hex'), secret))
check('missing signature refused', !paymobHmacValid(sample, '', secret))
check('missing secret refused', !paymobHmacValid(sample, good, ''))
check('truncated signature refused', !paymobHmacValid(sample, good.slice(0, 64), secret))

if (fail) { console.log(`paymob HMAC: ${fail} failed`); process.exit(1) }
console.log(`paymob HMAC: ${pass}/${pass} checks pass (signed string matches the Paymob docs example)`)
