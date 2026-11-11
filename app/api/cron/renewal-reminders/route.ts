import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { claimReminders, finishReminder, remindersReady } from '@/lib/payments.server'
import { sendRenewalEmail } from '@/lib/email/renewal'

// GET /api/cron/renewal-reminders — the daily renewal reminder job.
//
// Vercel calls it once a day (vercel.json → crons) on the live site and
// sends "Authorization: Bearer <CRON_SECRET>". Anyone else gets 401, and so
// does everyone while CRON_SECRET is not set in Vercel.
//
//   1. reminders_claim returns the subscribers whose Pro ends within 7 days
//      (kind "7d") or by tomorrow (kind "1d") and who have not had that
//      reminder for that end date, and reserves them
//   2. each one gets the email (lib/email/renewal.ts)
//   3. reminders_finish records it as sent, or frees it if the email failed
//      so the next day's run tries again
// Vercel may call a job twice or skip a day: a second call finds nothing
// left to claim, and a skipped day is picked up by the next run.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_PER_RUN = 40
const PAUSE_MS = 600

function authorized(request: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim()
  if (!secret) return false
  const got = Buffer.from(request.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 })
  if (!remindersReady()) return NextResponse.json({ ok: false, error: 'PAYMENTS_DB_SECRET is not set' }, { status: 503 })

  try {
    const due = await claimReminders(MAX_PER_RUN)
    let sent = 0
    let failed = 0
    for (let i = 0; i < due.length; i++) {
      const r = due[i]
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
      const ok = !!r.email && await sendRenewalEmail(r.email, r.name ?? '', {
        lang: r.lang === 'en' ? 'en' : 'ar',
        proUntil: r.pro_until,
        founding: r.founding === true,
      })
      await finishReminder(r.id, ok)
      if (ok) sent++; else failed++
    }
    console.log(`[reminders] due ${due.length}, sent ${sent}, failed ${failed}`)
    return NextResponse.json({ ok: true, due: due.length, sent, failed })
  } catch (err) {
    console.error('[reminders] run failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
