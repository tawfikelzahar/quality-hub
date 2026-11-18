// Who keeps the founding price after it has closed (lib/plan.ts keepsFounding):
// only a subscriber whose LAST paid payment was a founding one and whose Pro
// has not lapsed. An older founding payment never counts again once the
// subscriber came back at the regular price.
import { keepsFounding } from '../../../lib/plan.ts'
import { FOUNDING, PRICES, foundingEndsAtMs, foundingOpen, regionCanPay, regionForCountry } from '../../../lib/pricing.ts'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean) => { if (ok) pass++; else { fail++; console.log(`✗ ${name}`) } }

const now = Date.parse('2027-03-01T10:00:00Z')
const active = { subscription_status: 'pro', pro_until: '2027-03-20T10:00:00Z' }
const lapsed = { subscription_status: 'pro', pro_until: '2027-02-20T10:00:00Z' }
const free = { subscription_status: 'free', pro_until: null }
const noEnd = { subscription_status: 'pro', pro_until: null }

check('founding last payment + active Pro → keeps founding', keepsFounding(active, true, now))
check('founding last payment + Pro lapsed → regular', !keepsFounding(lapsed, true, now))
check('founding last payment + free account → regular', !keepsFounding(free, true, now))
check('regular last payment + active Pro → regular (came back after lapsing)', !keepsFounding(active, false, now))
check('no payment at all (Pro by hand) → regular', !keepsFounding(active, null, now) && !keepsFounding(active, undefined, now))
check('Pro with no end date is not a paying subscriber → regular', !keepsFounding(noEnd, true, now))
check('no profile → regular', !keepsFounding(null, true, now) && !keepsFounding(undefined, true, now))
check('exactly at the end date counts as lapsed', !keepsFounding({ subscription_status: 'pro', pro_until: '2027-03-01T10:00:00Z' }, true, now))
check('one second before the end still keeps it', keepsFounding({ subscription_status: 'pro', pro_until: '2027-03-01T10:00:01Z' }, true, now))

// When the founding price is open to everyone (lib/pricing.ts foundingOpen):
// it closes at the end of launch day + 60 days in Cairo. Expected moments
// worked out separately with Python's zoneinfo (Africa/Cairo), 18 Nov 2026.
const saved = { ...FOUNDING }
check('no launch date yet → open, no end', (FOUNDING.launchDate = null, foundingOpen(now) && foundingEndsAtMs() === null))
FOUNDING.launchDate = '2026-12-31'
check('31 Dec 2026 + 60 days → end of 1 Mar 2027, Cairo winter time', foundingEndsAtMs() === Date.parse('2027-03-01T21:59:59Z'))
check('before the end → open', foundingOpen(Date.parse('2027-03-01T21:59:58Z')))
check('exactly at the end → closed', !foundingOpen(Date.parse('2027-03-01T21:59:59Z')))
check('after the end → closed', !foundingOpen(Date.parse('2027-03-02T08:00:00Z')))
FOUNDING.launchDate = '2026-12-01'
check('1 Dec 2026 + 60 days → end of 30 Jan 2027 (+02:00)', foundingEndsAtMs() === Date.parse('2027-01-30T21:59:59Z'))
check('open on launch day itself', foundingOpen(Date.parse('2026-12-01T08:00:00Z')))
FOUNDING.launchDate = '2027-03-15'
check('ending in Cairo summer time → end of 14 May 2027 (+03:00)', foundingEndsAtMs() === Date.parse('2027-05-14T20:59:59Z'))
FOUNDING.launchDate = '2027-08-31'
check('ending the day after summer time ends → end of 30 Oct 2027 (+02:00)', foundingEndsAtMs() === Date.parse('2027-10-30T21:59:59Z'))
for (const bad of ['01-12-2026', '2026-12-1', '2026-02-30', 'not a date']) {
  FOUNDING.launchDate = bad
  check(`an unreadable launch date "${bad}" closes it rather than leaving it open forever`, !foundingOpen(now) && foundingEndsAtMs() === null)
}
FOUNDING.launchDate = null
FOUNDING.open = false
check('switched off → closed even with no launch date', !foundingOpen(now))
Object.assign(FOUNDING, saved)

// Price list by country (16 Nov 2026): Egypt and the six Gulf countries pay
// in EGP (Paymob takes Gulf cards on this account in EGP only); everyone
// else sees dollar prices with checkout closed.
check('Egypt and unknown country → Egyptian list', regionForCountry('EG') === 'eg' && regionForCountry(null) === 'eg' && regionForCountry('') === 'eg')
check('the six Gulf countries → Gulf list', ['SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'sa'].every(c => regionForCountry(c) === 'me'))
check('rest of the world → dollar list', ['JO', 'IQ', 'MA', 'US', 'GB', 'TR'].every(c => regionForCountry(c) === 'intl'))
check('Egypt and Gulf can pay, the rest cannot', regionCanPay('eg') && regionCanPay('me') && !regionCanPay('intl'))
check('Gulf list is in EGP, the rest in USD', PRICES.me.currency === 'EGP' && PRICES.eg.currency === 'EGP' && PRICES.intl.currency === 'USD')
const gulf = Object.fromEntries(PRICES.me.plans.map(p => [p.id, [p.price, p.founding]]))
check('Gulf prices as agreed (699/549 monthly, 5,390/4,290 yearly)', JSON.stringify(gulf) === JSON.stringify({ monthly: [699, 549], yearly: [5390, 4290] }))

if (fail) { console.log(`founding: ${fail} failed, ${pass} passed`); process.exit(1) }
console.log(`founding price rule: ${pass} checks pass`)
