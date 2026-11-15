// relative import so tests/golden/renewal can load this file without the @ alias
import { SITE } from '../site'
import { GREETINGS, greetingHtml, greetingText } from './greeting'

// ─────────────────────────────────────────────────────────────────────────
// "Your Pro plan ends soon" email. Sent by the daily job
// (app/api/cron/renewal-reminders) about 7 days before Pro ends and again
// the day before. Pro never renews by itself, so this is the only nudge a
// subscriber gets. Same look as the payment email: navy header, gold line,
// Arabic first with English under it. Through Resend's HTTP API.
// ─────────────────────────────────────────────────────────────────────────

const FROM = `${SITE.name} <contact@${SITE.domain}>`
const REPLY_TO = SITE.contact.email

export interface RenewalEmailData {
  lang: 'ar' | 'en'
  /** when Pro ends (ISO) */
  proUntil: string
  /** has paid a founding price before: keeps it by renewing before the end */
  founding: boolean
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
}

function cairoDate(ms: number): string {
  // en-CA prints YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
}

/**
 * Whole calendar days, in Cairo, from today to the day Pro ends:
 * 0 = ends today, 1 = ends tomorrow. Never below 0.
 */
export function cairoDaysLeft(proUntilIso: string, now: number = Date.now()): number {
  const end = Date.parse(proUntilIso)
  if (!Number.isFinite(end)) return 0
  const [y1, m1, d1] = cairoDate(now).split('-').map(Number)
  const [y2, m2, d2] = cairoDate(end).split('-').map(Number)
  const days = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
  return Math.max(0, days)
}

/** "غدًا" / "tomorrow", "بعد 7 أيام" / "in 7 days" */
export function whenPhrase(days: number): { ar: string; en: string } {
  if (days <= 0) return { ar: 'اليوم', en: 'today' }
  if (days === 1) return { ar: 'غدًا', en: 'tomorrow' }
  if (days === 2) return { ar: 'بعد يومين', en: 'in 2 days' }
  if (days <= 10) return { ar: `بعد ${days} أيام`, en: `in ${days} days` }
  return { ar: `بعد ${days} يومًا`, en: `in ${days} days` }
}

function day(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Cairo', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

export function renewalSubject(d: RenewalEmailData, now: number = Date.now()): string {
  const w = whenPhrase(cairoDaysLeft(d.proUntil, now))
  return `تذكير: باقة Pro تنتهي ${w.ar} · Your Pro plan ends ${w.en} — ${SITE.name}`
}

export function renewalEmailHtml(name: string, d: RenewalEmailData, now: number = Date.now()): string {
  const pre = d.lang === 'ar' ? '/ar' : ''
  const w = whenPhrase(cairoDaysLeft(d.proUntil, now))
  const founding = d.founding
    ? `<p style="margin:0 0 6px;font-size:13px;line-height:1.8;color:#85662F;font-weight:bold;">جدّد قبل انتهاء باقتك لتحتفظ بالسعر التأسيسي.</p>
<p dir="ltr" style="margin:0 0 18px;font-size:12.5px;line-height:1.7;color:#85662F;text-align:right;font-family:Arial,Helvetica,sans-serif;">Renew before your plan ends to keep your founding price.</p>`
    : ''
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${SITE.name} Pro</title></head>
<body style="margin:0;padding:0;background:#F1ECE1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">باقة Pro تنتهي ${w.ar} · Your Pro plan ends ${w.en}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1ECE1;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;">
<tr><td dir="rtl" align="right" style="background:#0A1120;padding:22px 28px;"><a href="${SITE.url}" style="text-decoration:none;"><img src="${SITE.url}/brand/email-logo-white.png" width="91" height="36" alt="${SITE.name}" style="display:inline-block;border:0;height:36px;width:91px;color:#F1ECE1;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;"></a></td></tr>
<tr><td style="background:#CDAA62;height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
<tr><td dir="rtl" align="right" style="padding:28px 28px 8px;font-family:Tahoma,Arial,sans-serif;text-align:right;">
${greetingHtml(GREETINGS.renewal, name)}
<p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#1F2937;">باقة <strong>Pro</strong> على حسابك تنتهي <strong>${w.ar}</strong>.</p>
<p dir="ltr" style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#6B7280;text-align:right;font-family:Arial,Helvetica,sans-serif;">Your Pro plan ends ${w.en}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr><td style="padding:8px 0;border-top:1px solid #EEE9DD;border-bottom:1px solid #EEE9DD;font-size:13px;color:#6B7280;white-space:nowrap;">تاريخ الانتهاء<br><span dir="ltr" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;">Ends on</span></td><td style="padding:8px 14px 8px 0;border-top:1px solid #EEE9DD;border-bottom:1px solid #EEE9DD;font-size:14px;color:#0B1F3F;font-weight:bold;text-align:left;"><span dir="rtl" style="unicode-bidi:isolate;">${esc(day(d.proUntil, 'ar-EG'))}</span><br><span dir="ltr" style="unicode-bidi:isolate;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:normal;color:#6B7280;">${esc(day(d.proUntil, 'en-GB'))}</span></td></tr></table>
<p style="margin:0 0 6px;font-size:13px;line-height:1.8;color:#3A475C;">لا يوجد تجديد تلقائي ولن يُخصم أي مبلغ من بطاقتك. للاستمرار جدّد من صفحة الأسعار، وتبدأ المدة الجديدة بعد تاريخ الانتهاء الحالي فلا تخسر أي يوم.</p>
<p dir="ltr" style="margin:0 0 18px;font-size:12.5px;line-height:1.7;color:#6B7280;text-align:right;font-family:Arial,Helvetica,sans-serif;">Nothing renews automatically and your card will not be charged. To continue, renew from the pricing page. The new period starts after your current end date, so you lose no days.</p>
${founding}<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td style="border-radius:10px;background:#0B1F3F;"><a href="${SITE.url}${pre}/pricing" style="display:inline-block;padding:13px 26px;font-family:Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:#F1ECE1;text-decoration:none;border-radius:10px;">جدّد الآن · Renew now</a></td></tr></table>
<div style="clear:both;font-size:0;line-height:0;">&nbsp;</div>
<p style="margin:22px 0 6px;font-size:13px;line-height:1.8;color:#3A475C;">إذا لم تجدد يعود حسابك إلى الخطة المجانية، ولا تُحذف مشاريعك المحفوظة وإعدادات تقاريرك، وتجدها عند التجديد.<br><span dir="ltr" style="color:#6B7280;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;">If you do not renew, your account returns to Free. Your saved projects and report settings are not deleted and are there again when you renew.</span></p>
<p style="margin:0 0 22px;font-size:12.5px;line-height:1.8;color:#6B7280;">لأي سؤال ردّ على هذه الرسالة · <span dir="ltr" style="font-family:Arial,Helvetica,sans-serif;">Questions? Just reply to this email.</span></p>
</td></tr>
<tr><td dir="rtl" align="right" style="border-top:1px solid #EEE9DD;padding:16px 28px 20px;font-family:Tahoma,Arial,sans-serif;text-align:right;">
<p style="margin:0;font-size:11px;line-height:1.7;color:#9CA3AF;"><a href="${SITE.url}" style="color:#85662F;text-decoration:none;font-weight:bold;">${SITE.name}</a> · ${SITE.contact.address.ar} · <span dir="ltr">${SITE.contact.address.en}</span></p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

export function renewalEmailText(name: string, d: RenewalEmailData, now: number = Date.now()): string {
  const pre = d.lang === 'ar' ? '/ar' : ''
  const w = whenPhrase(cairoDaysLeft(d.proUntil, now))
  return [
    ...greetingText(GREETINGS.renewal, name),
    `باقة Pro على حسابك تنتهي ${w.ar} (${day(d.proUntil, 'ar-EG')}).`,
    `Your Pro plan ends ${w.en} (${day(d.proUntil, 'en-GB')}).`,
    '',
    'لا يوجد تجديد تلقائي ولن يُخصم أي مبلغ من بطاقتك. للاستمرار جدّد من صفحة الأسعار.',
    'Nothing renews automatically and your card will not be charged. To continue, renew from the pricing page.',
    ...(d.founding ? ['', 'جدّد قبل انتهاء باقتك لتحتفظ بالسعر التأسيسي.', 'Renew before your plan ends to keep your founding price.'] : []),
    '',
    `${SITE.url}${pre}/pricing`,
  ].join('\n')
}

/** Sends the reminder. Returns false (never throws) when it could not be sent. */
export async function sendRenewalEmail(to: string, name: string, d: RenewalEmailData): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn('[renewal-email] RESEND_API_KEY is not set; email skipped'); return false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: REPLY_TO,
        subject: renewalSubject(d),
        html: renewalEmailHtml(name, d),
        text: renewalEmailText(name, d),
      }),
    })
    if (!res.ok) { console.warn('[renewal-email] Resend refused:', res.status, await res.text().catch(() => '')); return false }
    return true
  } catch (e) {
    console.warn('[renewal-email] send failed:', e)
    return false
  }
}
