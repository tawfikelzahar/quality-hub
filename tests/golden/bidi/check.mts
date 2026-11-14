// isolateLatin (lib/i18n/bidi.ts): which English stretches get the
// left-to-right marks in Arabic text, and that nothing else changes.
// Run: node --import ./tests/register.mjs --experimental-strip-types tests/golden/bidi/check.mts
import assert from 'node:assert/strict'
import { isolateLatin } from '../../../lib/i18n/bidi.ts'

const L = '⁦', P = '⁩'
let checks = 0
const eq = (input: string, want: string) => { assert.equal(isolateLatin(input), want, input); checks++ }
const same = (input: string) => eq(input, input)

// wrapped: brackets, commas, slashes, "=" inside the English part
eq('SPC: مخططات I-MR وX̄-R وX̄-S وAttribute (p, np, c, u)', `SPC: مخططات ${L}I-MR${P} و${L}X̄-R${P} و${L}X̄-S${P} و${L}Attribute (p, np, c, u)${P}`)
eq('القدرة (Cp, Cpk, Pp, Ppk, PPM)', `القدرة ${L}(Cp, Cpk, Pp, Ppk, PPM)${P}`)
eq('العملية غير قادرة (Cpk = 0.90)', `العملية غير قادرة ${L}(Cpk = 0.90)${P}`)
// a bracket whose partner is in the Arabic part stays outside the marks
eq('Gage R&R على بياناتك (طريقة AIAG Average & Range / ANOVA)', `${L}Gage R&R${P} على بياناتك (طريقة ${L}AIAG Average & Range / ANOVA${P})`)
// placeholders stay whole and inside the stretch they belong to
eq('العملية غير قادرة (Cpk = {v})', `العملية غير قادرة ${L}(Cpk = {v})${P}`)
eq('بناءً على {n} قراءة', 'بناءً على {n} قراءة')
eq('العملية غير قادرة ({idx} = {n})', `العملية غير قادرة ${L}({idx} = {n})${P}`)
eq('فترة الثقة: {a} – {b}', `فترة الثقة: ${L}{a} – {b}${P}`)
same('وفّر {n}%')
// left alone: plain words, numbers, Arabic only, English only, text with its own marks
same('اشترك في Pro الآن')
same('3 أشهر · وفّر 11%')
same('تقارير PDF وExcel باسمك')
same('كل الأدوات مجانية الاستخدام')
same('Process capability (Cp, Cpk)')
same(`حد ${L}α = 0.25${P} هنا`)
same('')
// running it twice changes nothing
const once = isolateLatin('مخططات Attribute (p, np, c, u)')
assert.equal(isolateLatin(once), once); checks++
// only invisible marks are added: removing them gives the original back
for (const s of ['القدرة (Cp, Cpk, Pp, Ppk, PPM)', 'Gage R&R على بياناتك (طريقة AIAG Average & Range / ANOVA)', 'حدود R = R̄ ± 3·d3·σ (ثوابت d2/d3 القياسية)']) {
  assert.equal(isolateLatin(s).replace(/[⁦⁩]/g, ''), s); checks++
}
console.log(`bidi: ${checks} checks pass`)
