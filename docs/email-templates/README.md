# Supabase auth email templates (Mizan Quality)

Arabic-first, English underneath, one bilingual button. Paste each into Supabase → Authentication → Emails → Templates.

- `confirm-signup.html` — subject: أكّد حسابك في Mizan Quality · Confirm your account
- `reset-password.html` — subject: إعادة تعيين كلمة المرور · Reset your password — Mizan Quality
- `change-email.html` — subject: أكّد بريدك الجديد · Confirm your new email — Mizan Quality

`{{ .Data.full_name }}` comes from the user's metadata (email sign-up form and Google both set it); the greeting falls back to مرحبًا alone.
Logo: /public/brand/email-logo-white.png (PNG; Gmail/Outlook don't show SVG). Sender: no-reply@mizanquality.com via Resend SMTP.
