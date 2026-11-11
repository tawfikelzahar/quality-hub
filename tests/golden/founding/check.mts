// Who keeps the founding price after it has closed (lib/plan.ts keepsFounding):
// only a subscriber whose LAST paid payment was a founding one and whose Pro
// has not lapsed. An older founding payment never counts again once the
// subscriber came back at the regular price.
import { keepsFounding } from '../../../lib/plan.ts'

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

if (fail) { console.log(`founding: ${fail} failed, ${pass} passed`); process.exit(1) }
console.log(`founding price rule: ${pass} checks pass`)
