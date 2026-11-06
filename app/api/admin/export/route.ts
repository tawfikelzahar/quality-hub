import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireAdmin, rpcError, type AdminUser } from '@/lib/admin.server'
import { isProRow } from '@/lib/plan'
import { SITE, SITE_SLUG } from '@/lib/site'

// GET /api/admin/export — every account as an Excel file (.xlsx). Admins only.
// Dates are written as real Excel dates in Cairo time, so they sort and filter.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TZ = 'Africa/Cairo'

/** The Cairo wall-clock time of an instant, as a Date Excel shows unchanged. */
function cairo(iso: string | null): Date | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  )
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second))
}

function planLabel(u: AdminUser, now: number): string {
  if (isProRow(u, now)) return u.pro_until ? 'Pro (until end date)' : 'Pro (no end date)'
  if (u.subscription_status === 'pro') return 'Free (Pro ended)'
  return 'Free'
}

export async function GET() {
  const auth = await requireAdmin()
  if ('refused' in auth) return auth.refused
  const { supabase } = auth

  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) return rpcError(error)
  const users = (data ?? []) as AdminUser[]
  const now = Date.now()

  const wb = new ExcelJS.Workbook()
  wb.creator = SITE.name
  wb.created = new Date()
  const ws = wb.addWorksheet('Users', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'Email', key: 'email', width: 34 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Plan', key: 'plan', width: 20 },
    { header: 'Pro until (Cairo)', key: 'until', width: 18, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
    { header: 'Signed up (Cairo)', key: 'created', width: 18, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
    { header: 'Last sign-in (Cairo)', key: 'last', width: 18, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
    { header: 'Sign-in method', key: 'provider', width: 14 },
    { header: 'Email confirmed', key: 'confirmed', width: 15 },
    { header: 'Welcome email sent (Cairo)', key: 'welcome', width: 22, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
    { header: 'User ID', key: 'id', width: 38 },
  ]
  for (const u of users) {
    const row = ws.addRow({
      email: u.email,
      name: u.full_name ?? '',
      plan: planLabel(u, now),
      until: cairo(u.pro_until),
      created: cairo(u.created_at),
      last: cairo(u.last_sign_in_at),
      provider: u.provider,
      confirmed: u.email_confirmed ? 'Yes' : 'No',
      welcome: cairo(u.welcome_sent_at),
      id: u.id,
    })
    if (isProRow(u, now)) {
      row.getCell('plan').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6EBD2' } }
      row.getCell('plan').font = { bold: true, color: { argb: 'FF85662F' } }
    }
  }
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFF1ECE1' } }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3F' } }
  head.alignment = { vertical: 'middle' }
  head.height = 22
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } }

  const buffer = await wb.xlsx.writeBuffer()

  const logged = await supabase.rpc('admin_log_event', { action: 'export_users', target: null, details: { rows: users.length } })
  if (logged.error) console.error('[admin] log failed', logged.error.message)

  const day = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${SITE_SLUG}-users-${day}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
