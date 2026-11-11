// Renewal reminder email: the "days left" count is by Cairo calendar days
// (not 24-hour blocks), the wording follows it in both languages, and the
// founding-price line appears only for a founding subscriber.
import { cairoDaysLeft, whenPhrase, renewalSubject, renewalEmailHtml, renewalEmailText } from '../../../lib/email/renewal.ts'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean) => { if (ok) pass++; else { fail++; console.log(`✗ ${name}`) } }

// Cairo is UTC+2 in winter and UTC+3 in summer (DST).
const at = (iso: string) => Date.parse(iso)

// Job runs 09:00 Cairo on 10 Nov 2026 (07:00 UTC)
const run = at('2026-11-10T07:00:00Z')
check('ends later the same Cairo day → 0', cairoDaysLeft('2026-11-10T20:00:00Z', run) === 0)
check('ends tomorrow morning (under 24h) → 1', cairoDaysLeft('2026-11-11T05:00:00Z', run) === 1)
check('ends tomorrow evening (over 24h) → 1', cairoDaysLeft('2026-11-11T19:00:00Z', run) === 1)
check('ends 23:30 Cairo tomorrow → 1', cairoDaysLeft('2026-11-11T21:30:00Z', run) === 1)
check('ends 00:30 Cairo the day after → 2', cairoDaysLeft('2026-11-11T22:30:00Z', run) === 2)
check('ends in a week → 7', cairoDaysLeft('2026-11-17T12:00:00Z', run) === 7)
check('already ended → 0, never negative', cairoDaysLeft('2026-11-01T12:00:00Z', run) === 0)
check('bad date → 0', cairoDaysLeft('not a date', run) === 0)

// Summer time: 21:30 UTC on 14 Jul is already 00:30 on 15 Jul in Cairo (UTC+3)
const summer = at('2026-07-13T07:00:00Z')
check('summer time: 21:30 UTC next day is 2 Cairo days away', cairoDaysLeft('2026-07-14T21:30:00Z', summer) === 2)
check('summer time: 20:30 UTC next day is 1 Cairo day away', cairoDaysLeft('2026-07-14T20:30:00Z', summer) === 1)

// Month and year ends
check('across a month end', cairoDaysLeft('2026-12-03T10:00:00Z', at('2026-11-28T07:00:00Z')) === 5)
check('across a year end', cairoDaysLeft('2027-01-02T10:00:00Z', at('2026-12-30T07:00:00Z')) === 3)

// Wording
const same = (p: { ar: string; en: string }, ar: string, en: string) => p.ar === ar && p.en === en
check('0 days', same(whenPhrase(0), 'اليوم', 'today'))
check('1 day', same(whenPhrase(1), 'غدًا', 'tomorrow'))
check('2 days (Arabic dual)', same(whenPhrase(2), 'بعد يومين', 'in 2 days'))
check('3 days (Arabic plural)', same(whenPhrase(3), 'بعد 3 أيام', 'in 3 days'))
check('7 days', same(whenPhrase(7), 'بعد 7 أيام', 'in 7 days'))
check('11 days (Arabic singular form)', same(whenPhrase(11), 'بعد 11 يومًا', 'in 11 days'))

// The email itself
const founding = { lang: 'ar' as const, proUntil: '2026-11-17T12:00:00Z', founding: true }
const regular = { lang: 'en' as const, proUntil: '2026-11-11T12:00:00Z', founding: false }
const htmlF = renewalEmailHtml('Ahmed <b>', founding, run)
const htmlR = renewalEmailHtml('', regular, run)

check('subject says 7 days', renewalSubject(founding, run).includes('بعد 7 أيام') && renewalSubject(founding, run).includes('in 7 days'))
check('subject says tomorrow', renewalSubject(regular, run).includes('غدًا') && renewalSubject(regular, run).includes('tomorrow'))
check('subject starts with an Arabic word', /^[؀-ۿ]/.test(renewalSubject(regular, run)))
check('name is escaped', htmlF.includes('Ahmed &lt;b&gt;') && !htmlF.includes('Ahmed <b>'))
check('no name → plain greeting', htmlR.includes('>مرحبًا،<'))
check('end date in Arabic and English', htmlF.includes('١٧ نوفمبر ٢٠٢٦') && htmlF.includes('17 November 2026'))
check('founding line for a founding subscriber', htmlF.includes('السعر التأسيسي') && htmlF.includes('founding price'))
check('no founding line otherwise', !htmlR.includes('السعر التأسيسي') && !htmlR.includes('founding price'))
check('Arabic link for an Arabic subscriber', htmlF.includes('/ar/pricing"'))
check('English link for an English subscriber', htmlR.includes('/pricing"') && !htmlR.includes('/ar/pricing'))
check('says nothing renews automatically', htmlR.includes('لا يوجد تجديد تلقائي') && htmlR.includes('Nothing renews automatically'))
check('no unfilled value', !/undefined|NaN|Invalid Date/.test(htmlF + htmlR + renewalEmailText('x', founding, run) + renewalEmailText('', regular, run)))
check('text version has the pricing link', renewalEmailText('', founding, run).includes('/ar/pricing'))

if (fail) { console.log(`renewal: ${fail} failed, ${pass} passed`); process.exit(1) }
console.log(`renewal reminder email: ${pass} checks pass`)
