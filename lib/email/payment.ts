// relative imports so tests/golden/email can load this file without the @ alias
import { SITE } from '../site'
import { GREETINGS, greetingHtml, greetingText } from './greeting'

// ─────────────────────────────────────────────────────────────────────────
// "Pro is active" email, sent once when Paymob confirms a payment
// (app/api/paymob/callback). Same look as the welcome email: navy header,
// gold line, Arabic first with English under it. Through Resend's HTTP API.
// ─────────────────────────────────────────────────────────────────────────

const FROM = `${SITE.name} <contact@${SITE.domain}>`
const REPLY_TO = SITE.contact.email

export interface PaymentEmailData {
  lang: 'ar' | 'en'
  months: number
  amountCents: number
  currency: 'EGP' | 'USD'
  proUntil: string | null
  reference: string
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
}

function money(cents: number, currency: 'EGP' | 'USD', ar: boolean): string {
  const v = cents / 100
  const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v)
  if (currency === 'USD') return `$${n}`
  return ar ? `${n} ج.م` : `EGP ${n}`
}

function day(iso: string | null, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Cairo', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

const PERIOD: Record<number, { ar: string; en: string }> = {
  1: { ar: 'شهر', en: '1 month' },
  3: { ar: '3 أشهر', en: '3 months' },
  12: { ar: 'سنة', en: '1 year' },
}

// Each value is one line per language, so Arabic and English never share a
// line (mixed on one line, mail apps reorder them: "year 1 · سنة").
function rows(d: PaymentEmailData): { ar: string; en: string; value: string; valueEn?: string }[] {
  const period = PERIOD[d.months] ?? { ar: `${d.months} شهرًا`, en: `${d.months} months` }
  const list: { ar: string; en: string; value: string; valueEn?: string }[] = [
    { ar: 'الباقة', en: 'Plan', value: `${SITE.name} Pro` },
    { ar: 'المدة', en: 'Period', value: period.ar, valueEn: period.en },
    { ar: 'المبلغ المدفوع', en: 'Amount paid', value: money(d.amountCents, d.currency, false) },
  ]
  if (d.proUntil) list.push({ ar: 'Pro فعّالة حتى', en: 'Pro active until', value: day(d.proUntil, 'ar-EG'), valueEn: day(d.proUntil, 'en-GB') })
  if (d.reference) list.push({ ar: 'رقم العملية', en: 'Payment reference', value: d.reference })
  return list
}

export function paymentEmailHtml(name: string, d: PaymentEmailData): string {
  const pre = d.lang === 'ar' ? '/ar' : ''
  const table = rows(d).map((r) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #EEE9DD;font-size:13px;color:#6B7280;white-space:nowrap;">${r.ar}<br><span dir="ltr" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;">${r.en}</span></td><td style="padding:8px 14px 8px 0;border-bottom:1px solid #EEE9DD;font-size:14px;color:#0B1F3F;font-weight:bold;text-align:left;"><span dir="${r.valueEn ? 'rtl' : 'ltr'}" style="unicode-bidi:isolate;">${esc(r.value)}</span>${r.valueEn ? `<br><span dir="ltr" style="unicode-bidi:isolate;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:normal;color:#6B7280;">${esc(r.valueEn)}</span>` : ''}</td></tr>`).join('')
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${SITE.name} Pro</title></head>
<body style="margin:0;padding:0;background:#F1ECE1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">تم تفعيل Pro على حسابك · Pro is active on your account</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1ECE1;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;">
<tr><td dir="rtl" align="right" style="background:#0A1120;padding:22px 28px;"><a href="${SITE.url}" style="text-decoration:none;"><img src="${SITE.url}/brand/email-logo-white.png" width="91" height="36" alt="${SITE.name}" style="display:inline-block;border:0;height:36px;width:91px;color:#F1ECE1;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;"></a></td></tr>
<tr><td style="background:#CDAA62;height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
<tr><td dir="rtl" align="right" style="padding:28px 28px 8px;font-family:Tahoma,Arial,sans-serif;text-align:right;">
${greetingHtml(GREETINGS.payment, name)}
<p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#1F2937;">استلمنا دفعتك، وتم تفعيل <strong>Pro</strong> على حسابك.</p>
<p dir="ltr" style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#6B7280;text-align:right;font-family:Arial,Helvetica,sans-serif;">We received your payment and Pro is active on your account.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">${table}</table>
<p style="margin:0 0 6px;font-size:13px;line-height:1.8;color:#3A475C;">هذه دفعة واحدة ولا تتجدد تلقائيًا. إذا جددت قبل انتهاء باقتك تبدأ المدة الجديدة بعد تاريخ الانتهاء الحالي.</p>
<p dir="ltr" style="margin:0 0 18px;font-size:12.5px;line-height:1.7;color:#6B7280;text-align:right;font-family:Arial,Helvetica,sans-serif;">This is a one-time payment and nothing renews automatically. Renew before your plan ends and the new period starts after your current end date.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td style="border-radius:10px;background:#0B1F3F;"><a href="${SITE.url}${pre}/account#branding" style="display:inline-block;padding:13px 26px;font-family:Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:#F1ECE1;text-decoration:none;border-radius:10px;">جهّز تقاريرك · Set up your reports</a></td></tr></table>
<div style="clear:both;font-size:0;line-height:0;">&nbsp;</div>
<p style="margin:22px 0 6px;font-size:13px;line-height:1.8;color:#3A475C;">أضف اسمك ووظيفتك وشعار شركتك من صفحة حسابك ليظهروا في تقارير PDF وExcel.<br><span dir="ltr" style="color:#6B7280;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;">Add your name, job title and company logo from your account page so they appear on your PDF and Excel reports.</span></p>
<p style="margin:0 0 22px;font-size:12.5px;line-height:1.8;color:#6B7280;">لأي سؤال ردّ على هذه الرسالة · <span dir="ltr" style="font-family:Arial,Helvetica,sans-serif;">Questions? Just reply to this email.</span></p>
</td></tr>
<tr><td dir="rtl" align="right" style="border-top:1px solid #EEE9DD;padding:16px 28px 20px;font-family:Tahoma,Arial,sans-serif;text-align:right;">
<p style="margin:0;font-size:11px;line-height:1.7;color:#9CA3AF;"><a href="${SITE.url}" style="color:#85662F;text-decoration:none;font-weight:bold;">${SITE.name}</a> · ${SITE.contact.address.ar} · <span dir="ltr">${SITE.contact.address.en}</span></p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

export function paymentEmailText(name: string, d: PaymentEmailData): string {
  return [
    ...greetingText(GREETINGS.payment, name),
    'استلمنا دفعتك، وتم تفعيل Pro على حسابك.',
    'We received your payment and Pro is active on your account.',
    '',
    ...rows(d).map((r) => `${r.ar} · ${r.en}: ${r.value}${r.valueEn ? ` · ${r.valueEn}` : ''}`),
    '',
    'هذه دفعة واحدة ولا تتجدد تلقائيًا. · One-time payment, nothing renews automatically.',
    `${SITE.url}/account#branding`,
  ].join('\n')
}

/** Sends the payment confirmation. Returns false (never throws) when it could not be sent. */
export async function sendPaymentEmail(to: string, name: string, d: PaymentEmailData): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn('[payment-email] RESEND_API_KEY is not set; email skipped'); return false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: REPLY_TO,
        subject: `تم تفعيل Pro على حسابك · Pro is active — ${SITE.name}`,
        html: paymentEmailHtml(name, d),
        text: paymentEmailText(name, d),
      }),
    })
    if (!res.ok) { console.warn('[payment-email] Resend refused:', res.status, await res.text().catch(() => '')); return false }
    return true
  } catch (e) {
    console.warn('[payment-email] send failed:', e)
    return false
  }
}
