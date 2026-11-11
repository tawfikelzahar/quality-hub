// The greeting at the top of the welcome, payment and renewal emails: Arabic
// line then English line, the name in BOTH lines inside <bdi> (so Arabic and
// English names both keep their own direction), HTML-escaped, and a plain
// greeting when there is no name.
import { welcomeEmailHtml, welcomeEmailText } from '../../../lib/email/welcome.ts'
import { paymentEmailHtml, paymentEmailText } from '../../../lib/email/payment.ts'
import { renewalEmailHtml, renewalEmailText } from '../../../lib/email/renewal.ts'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean) => { if (ok) pass++; else { fail++; console.log(`✗ ${name}`) } }
const count = (s: string, part: string) => s.split(part).length - 1

const pay = { lang: 'ar' as const, months: 1, amountCents: 29900, currency: 'EGP' as const, proUntil: '2026-12-11T10:00:00Z', reference: '123' }
const ren = { lang: 'ar' as const, proUntil: '2026-11-18T13:00:00Z', founding: false }
const now = Date.parse('2026-11-11T07:00:00Z')

const emails: { id: string; html: (n: string) => string; text: (n: string) => string; arWord: string; enWord: string }[] = [
  { id: 'welcome', html: (n) => welcomeEmailHtml(n, 'ar'), text: (n) => welcomeEmailText(n), arWord: 'مرحبًا', enWord: 'Hello' },
  { id: 'payment', html: (n) => paymentEmailHtml(n, pay), text: (n) => paymentEmailText(n, pay), arWord: 'شكرًا', enWord: 'Thank you' },
  { id: 'renewal', html: (n) => renewalEmailHtml(n, ren, now), text: (n) => renewalEmailText(n, ren, now), arWord: 'مرحبًا', enWord: 'Hello' },
]

for (const e of emails) {
  for (const name of ['Tawfik Elzahar', 'محمد أحمد', 'Ali (QA) 2']) {
    const h = e.html(name)
    check(`${e.id} · "${name}" appears in both lines inside <bdi>`, count(h, `<bdi>${name}</bdi>`) === 2)
    check(`${e.id} · "${name}": Arabic line starts with the Arabic word`, h.includes(`>${e.arWord} <bdi>${name}</bdi>`))
    check(`${e.id} · "${name}": English line starts with the English word`, h.includes(`${e.enWord}${e.id === 'payment' ? ', ' : ' '}<bdi>${name}</bdi>`))
    const t = e.text(name).split('\n')
    check(`${e.id} · "${name}": text version has both lines`, t[0].includes(e.arWord) && t[0].includes(name) && t[1].includes(e.enWord) && t[1].includes(name))
  }
  const evil = e.html('<script>alert(1)</script>')
  check(`${e.id} · name is escaped`, !evil.includes('<script>') && evil.includes('&lt;script&gt;'))
  const none = e.html('')
  check(`${e.id} · no name → plain greeting in both languages`, !none.includes('<bdi>') && none.includes(`>${e.arWord}`) && none.includes(e.enWord))
  check(`${e.id} · blank name counts as no name`, !e.html('   ').includes('<bdi>'))
  check(`${e.id} · no unfilled value`, !/undefined|NaN|\[object/.test(none + e.html('X') + e.text('') + e.text('X')))
  check(`${e.id} · English line is left-to-right`, /<p dir="ltr"[^>]*>(Hello|Thank you)/.test(none))
}

check('welcome keeps its wave, payment its party emoji, once each', welcomeEmailHtml('A', 'ar').includes(' 👋<') && count(welcomeEmailHtml('A', 'ar'), '👋') === 1 && paymentEmailHtml('A', pay).includes(' 🎉<') && count(paymentEmailHtml('A', pay), '🎉') === 1)
check('renewal has the Arabic comma after the name', renewalEmailHtml('A', ren, now).includes('<bdi>A</bdi>،<'))
check('renewal English line has a comma after the name', renewalEmailHtml('A', ren, now).includes('Hello <bdi>A</bdi>,<'))

if (fail) { console.log(`email greeting: ${fail} failed, ${pass} passed`); process.exit(1) }
console.log(`email greeting: ${pass} checks pass`)
