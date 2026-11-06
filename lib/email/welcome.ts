import { SITE } from '@/lib/site'

// ─────────────────────────────────────────────────────────────────────────
// Welcome email sent once to every new account (email or Google), through
// Resend's HTTP API with RESEND_API_KEY. Same look as the Supabase auth
// templates in docs/email-templates (navy header, gold line, Arabic first).
// Only claims what the site offers today (see the home page plans).
// ─────────────────────────────────────────────────────────────────────────

const FROM = `${SITE.name} <contact@${SITE.domain}>`
const REPLY_TO = `contact@${SITE.domain}`

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
}

export function welcomeEmailHtml(name: string, lang: 'ar' | 'en'): string {
  const start = `${SITE.url}${lang === 'ar' ? '/ar' : ''}/spc`
  const hello = name ? `مرحبًا ${esc(name)} 👋` : 'مرحبًا 👋'
  const li = (ar: string, en: string) =>
    `<tr><td valign="top" style="padding:0 0 10px 8px;color:#CDAA62;font-size:15px;line-height:1.7;">◆</td><td style="padding:0 0 10px;font-size:14px;line-height:1.7;color:#1F2937;">${ar}<br><span dir="ltr" style="color:#6B7280;font-family:Arial,Helvetica,sans-serif;font-size:13px;">${en}</span></td></tr>`
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Welcome to ${SITE.name}</title></head>
<body style="margin:0;padding:0;background:#F1ECE1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">حسابك جاهز · Your account is ready</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1ECE1;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;">
<tr><td dir="rtl" align="right" style="background:#0A1120;padding:22px 28px;"><a href="${SITE.url}" style="text-decoration:none;"><img src="${SITE.url}/brand/email-logo-white.png" width="91" height="36" alt="${SITE.name}" style="display:inline-block;border:0;height:36px;width:91px;color:#F1ECE1;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;"></a></td></tr>
<tr><td style="background:#CDAA62;height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
<tr><td dir="rtl" align="right" style="padding:28px 28px 8px;font-family:Tahoma,Arial,sans-serif;text-align:right;">
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.5;color:#0B1F3F;">${hello}</h1>
<p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#1F2937;">تم تفعيل حسابك في <strong>${SITE.name}</strong>. يسعدنا انضمامك.</p>
<p dir="ltr" style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#6B7280;text-align:right;font-family:Arial,Helvetica,sans-serif;">Your ${SITE.name} account is active. We're glad to have you.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
${li('كل أداة مجانية بنتائجها كاملة على الشاشة', 'Every tool is free, with full results on screen')}
${li('صدّر نتائجك CSV وPNG بحسابك المجاني', 'Export CSV and PNG with your free account')}
${li('ومع Pro: تقارير PDF وExcel باسمك وشعار شركتك', 'With Pro: PDF and Excel reports with your name and company logo')}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td style="border-radius:10px;background:#0B1F3F;"><a href="${start}" style="display:inline-block;padding:13px 26px;font-family:Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:#F1ECE1;text-decoration:none;border-radius:10px;">ابدأ الآن · Get started</a></td></tr></table>
<div style="clear:both;font-size:0;line-height:0;">&nbsp;</div>
<p style="margin:22px 0 0;font-size:13px;line-height:1.8;color:#3A475C;">أنا توفيق، مهندس جودة وصاحب المنصة. لو عندك أي سؤال أو اقتراح ردّ على هذه الرسالة وستصلني مباشرة.<br><span dir="ltr" style="color:#6B7280;font-family:Arial,Helvetica,sans-serif;">I'm Tawfik, a quality engineer and the founder. Questions or ideas? Just reply to this email.</span></p>
<p style="margin:10px 0 22px;font-size:13px;color:#85662F;font-weight:bold;">— ${esc(SITE.owner)}</p>
</td></tr>
<tr><td dir="rtl" align="right" style="border-top:1px solid #EEE9DD;padding:16px 28px 20px;font-family:Tahoma,Arial,sans-serif;text-align:right;">
<p style="margin:0;font-size:11px;line-height:1.7;color:#9CA3AF;"><a href="${SITE.url}" style="color:#85662F;text-decoration:none;font-weight:bold;">${SITE.name}</a> · منصة هندسة الجودة · <span dir="ltr">Quality Engineering Platform</span></p>
<p style="margin:2px 0 0;font-size:11px;line-height:1.7;color:#9CA3AF;">وصلتك لأنك أنشأت حسابًا في ${SITE.domain} · <span dir="ltr" style="font-family:Arial,Helvetica,sans-serif;">You received this because you created an account.</span></p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

export function welcomeEmailText(name: string): string {
  return [
    name ? `مرحبًا ${name}` : 'مرحبًا',
    `تم تفعيل حسابك في ${SITE.name}. يسعدنا انضمامك.`,
    `Your ${SITE.name} account is active. We're glad to have you.`,
    '',
    `ابدأ الآن · Get started: ${SITE.url}/spc`,
    '',
    'أنا توفيق، مهندس جودة وصاحب المنصة. ردّ على هذه الرسالة بأي سؤال.',
    `— ${SITE.owner}`,
  ].join('\n')
}

/** Sends the welcome email. Returns false (never throws) when it could not be sent. */
export async function sendWelcomeEmail(to: string, name: string, lang: 'ar' | 'en'): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn('[welcome] RESEND_API_KEY is not set; welcome email skipped'); return false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: REPLY_TO,
        subject: `أهلًا بك في ${SITE.name} · Welcome to ${SITE.name}`,
        html: welcomeEmailHtml(name, lang),
        text: welcomeEmailText(name),
      }),
    })
    if (!res.ok) { console.warn('[welcome] Resend refused:', res.status, await res.text().catch(() => '')); return false }
    return true
  } catch (e) {
    console.warn('[welcome] send failed:', e)
    return false
  }
}
