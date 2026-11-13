'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Nav from '@/components/Nav'
import AccountStyles from '@/components/AccountStyles'
import { usePersistedTheme } from '@/lib/theme'
import { isProRow } from '@/lib/plan'

// ─────────────────────────────────────────────────────────────────────────
// Admin dashboard UI (/admin). English only: it is for the site owner, not
// for visitors. Every action goes through /api/admin/*, where the database
// checks the admin again (supabase/sql/010_admin_dashboard.sql).
// ─────────────────────────────────────────────────────────────────────────

interface User {
  id: string
  email: string
  full_name: string | null
  provider: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  subscription_status: 'free' | 'pro'
  pro_until: string | null
  welcome_sent_at: string | null
  price?: 'founding' | 'regular' | null
}

interface LogRow {
  id: number
  created_at: string
  admin_email: string
  action: string
  target_email: string | null
  details: Record<string, unknown>
}

type Filter = 'all' | 'pro' | 'free' | 'ending' | 'ended'
type Duration = '1m' | '3m' | '1y' | 'date' | 'none'

const DAY = 24 * 60 * 60 * 1000
const TZ = 'Africa/Cairo'

function fmtDate(iso: string | null, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d)
}

/** Adds whole months, keeping the day inside the target month (31 Jan + 1 month = 28/29 Feb). */
function addMonths(from: Date, months: number): Date {
  const d = new Date(from)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return d
}

type PlanState = 'pro' | 'pro-open' | 'ended' | 'free'
function planState(u: User, now: number): PlanState {
  if (isProRow(u, now)) return u.pro_until ? 'pro' : 'pro-open'
  return u.subscription_status === 'pro' ? 'ended' : 'free'
}

function endingSoon(u: User, now: number): boolean {
  if (!isProRow(u, now) || !u.pro_until) return false
  return Date.parse(u.pro_until) - now <= 7 * DAY
}

function actionLabel(r: LogRow): string {
  const d = r.details ?? {}
  if (r.action === 'set_pro') {
    const until = typeof d.until === 'string' ? fmtDate(d.until) : 'no end date'
    return `Pro given · until ${until}`
  }
  if (r.action === 'set_free') return 'Pro removed'
  if (r.action === 'resend_welcome') return `Welcome email sent again (${d.lang === 'en' ? 'English' : 'Arabic'})`
  if (r.action === 'export_users') return `Users exported to Excel (${typeof d.rows === 'number' ? d.rows : '?'} rows)`
  return r.action
}

type Loaded = { users: User[]; log: LogRow[]; now: number } | { error: string }

async function fetchAdminData(): Promise<Loaded> {
  try {
    const res = await fetch('/api/admin/users', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { error: json.error || `Could not load users (${res.status}).` }
    return { users: json.users ?? [], log: json.log ?? [], now: Date.parse(json.now) || Date.now() }
  } catch {
    return { error: 'Could not reach the server.' }
  }
}

export default function AdminDashboard() {
  const [theme, setTheme] = usePersistedTheme()
  const [users, setUsers] = useState<User[] | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [now, setNow] = useState(0)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const apply = useCallback((r: Loaded) => {
    if ('error' in r) { setError(r.error); return }
    setUsers(r.users)
    setLog(r.log)
    setNow(r.now)
    setError('')
  }, [])

  const load = useCallback(async () => { apply(await fetchAdminData()) }, [apply])

  useEffect(() => {
    let alive = true
    fetchAdminData().then((r) => { if (alive) apply(r) })
    return () => { alive = false }
  }, [apply])

  const stats = useMemo(() => {
    const list = users ?? []
    const pro = list.filter((u) => isProRow(u, now)).length
    return {
      total: list.length,
      pro,
      free: list.length - pro,
      week: list.filter((u) => now - Date.parse(u.created_at) <= 7 * DAY).length,
      ending: list.filter((u) => endingSoon(u, now)).length,
    }
  }, [users, now])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (users ?? []).filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !(u.full_name ?? '').toLowerCase().includes(q)) return false
      const st = planState(u, now)
      if (filter === 'pro') return st === 'pro' || st === 'pro-open'
      if (filter === 'free') return st === 'free' || st === 'ended'
      if (filter === 'ending') return endingSoon(u, now)
      if (filter === 'ended') return st === 'ended'
      return true
    })
  }, [users, query, filter, now])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--qh-bg)', color: 'var(--qh-text)' }} dir="ltr" lang="en">
      <AccountStyles />
      <AdminStyles />
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_admin" showGetPro={false} />
      <main className="ac-wrap">
        <div className="ad-head">
          <div>
            <h1 className="ad-h1">Admin</h1>
            <div className="ac-sub">Accounts, plans and manual Pro · times in Cairo</div>
          </div>
          <div className="ac-row-actions">
            <button type="button" className="ac-btn" onClick={() => void load()}>Refresh</button>
            <a className="ac-btn ac-btn-primary" href="/api/admin/export" download>Export Excel</a>
          </div>
        </div>

        {error && <div className="ac-card ad-gap"><div className="ac-error">{error}</div></div>}

        <div className="ad-stats">
          <Stat label="Accounts" value={stats.total} />
          <Stat label="Pro now" value={stats.pro} gold />
          <Stat label="Free" value={stats.free} />
          <Stat label="New · 7 days" value={stats.week} />
          <Stat label="Pro ending · 7 days" value={stats.ending} warn={stats.ending > 0} />
        </div>

        <section className="ac-card ad-gap" aria-labelledby="ad-users-h">
          <div className="ac-card-top">
            <h2 id="ad-users-h">Users</h2>
            <span className="ac-muted">{users ? `${shown.length} of ${users.length}` : ''}</span>
          </div>
          <div className="ad-tools">
            <input
              className="ac-input"
              type="search"
              placeholder="Search by email or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search users"
            />
            <select className="ac-input ad-select" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Filter by plan">
              <option value="all">All plans</option>
              <option value="pro">Pro now</option>
              <option value="free">Free</option>
              <option value="ending">Pro ending in 7 days</option>
              <option value="ended">Pro ended</option>
            </select>
          </div>

          {!users && !error && <div className="ac-empty">Loading…</div>}
          {users && shown.length === 0 && <div className="ac-empty">No users match.</div>}

          <div className="ad-list">
            {shown.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                now={now}
                open={openId === u.id}
                onToggle={() => setOpenId(openId === u.id ? null : u.id)}
                onChanged={load}
              />
            ))}
          </div>
        </section>

        <PaymentsSection />

        <section className="ac-card ad-gap" aria-labelledby="ad-log-h">
          <div className="ac-card-top">
            <h2 id="ad-log-h">Activity log</h2>
            <span className="ac-muted">Last 100 admin actions</span>
          </div>
          {log.length === 0 && <div className="ac-empty">No admin actions yet.</div>}
          {log.map((r) => (
            <div className="ac-row" key={r.id}>
              <div style={{ minWidth: 0 }}>
                <div className="ac-row-title">{actionLabel(r)}</div>
                <div className="ac-row-sub ad-break">
                  {r.target_email ?? 'All users'}
                  {typeof r.details?.note === 'string' && r.details.note ? ` · ${r.details.note}` : ''}
                </div>
              </div>
              <div className="ac-muted">{fmtDate(r.created_at, true)}</div>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}

interface PaymentRow {
  id: string
  created_at: string
  email: string | null
  plan: string
  months: number
  amount_cents: number
  currency: string
  founding: boolean
  mode: 'test' | 'live'
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  fail_reason: string | null
  country: string | null
  phone?: string | null
  paymob_transaction_id: number | null
  paid_at: string | null
  pro_until: string | null
}

// Payment attempts through Paymob (supabase/sql/012_payments.sql). A pending
// row that never turns paid is someone who opened the payment page and left.
function PaymentsSection() {
  const [rows, setRows] = useState<PaymentRow[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/api/admin/payments', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok) { setErr(json.error || `Could not load payments (${res.status}).`); return }
        setRows(json.rows ?? [])
      })
      .catch(() => { if (alive) setErr('Could not reach the server.') })
    return () => { alive = false }
  }, [])

  const paid = (rows ?? []).filter((r) => r.status === 'paid' && r.mode === 'live')
  const total = paid.reduce((sum, r) => sum + (r.currency === 'EGP' ? r.amount_cents : 0), 0) / 100

  return (
    <section className="ac-card ad-gap" aria-labelledby="ad-pay-h">
      <div className="ac-card-top">
        <h2 id="ad-pay-h">Payments</h2>
        <span className="ac-muted">{rows ? `${paid.length} live paid · EGP ${total.toLocaleString('en-US')}` : ''}</span>
      </div>
      {err && <div className="ac-msg-err">{err}</div>}
      {!err && !rows && <div className="ac-empty">Loading…</div>}
      {rows && rows.length === 0 && <div className="ac-empty">No payments yet.</div>}
      {rows && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="ad-usage-t">
            <thead>
              <tr><th>Date</th><th>Email</th><th>Mobile</th><th>Plan</th><th>Amount</th><th>Status</th><th>Paymob ref</th><th>Pro until</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.created_at, true)}</td>
                  <td className="ad-break">{r.email ?? '—'}{r.country ? ` · ${r.country}` : ''}</td>
                  <td dir="ltr">{r.phone ?? '—'}</td>
                  <td>{r.plan}{r.founding ? ' · founding' : ''}</td>
                  <td>{r.currency} {(r.amount_cents / 100).toLocaleString('en-US')}</td>
                  <td style={{ color: r.status === 'paid' ? 'var(--qh-gold)' : r.status === 'failed' ? 'var(--qh-danger)' : undefined, fontWeight: 600 }}>
                    {r.status}{r.mode === 'test' ? ' (test)' : ''}{r.fail_reason ? ` · ${r.fail_reason}` : ''}
                  </td>
                  <td>{r.paymob_transaction_id ?? '—'}</td>
                  <td>{fmtDate(r.pro_until)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, gold, warn }: { label: string; value: number; gold?: boolean; warn?: boolean }) {
  return (
    <div className={`ac-card ad-stat${gold ? ' ac-card-gold' : ''}`}>
      <div className="ad-stat-v" style={warn ? { color: 'var(--qh-danger)' } : gold ? { color: 'var(--qh-gold)' } : undefined}>{value}</div>
      <div className="ac-muted">{label}</div>
    </div>
  )
}

function PlanPill({ user, now }: { user: User; now: number }) {
  const st = planState(user, now)
  if (st === 'pro' || st === 'pro-open') return <span className="ac-pill ac-pill-pro">PRO</span>
  if (st === 'ended') return <span className="ac-pill ac-pill-free" style={{ color: 'var(--qh-danger)' }}>PRO ENDED</span>
  return <span className="ac-pill ac-pill-free">FREE</span>
}

function UserRow({ user, now, open, onToggle, onChanged }: {
  user: User; now: number; open: boolean; onToggle: () => void; onChanged: () => Promise<void>
}) {
  const st = planState(user, now)
  const active = st === 'pro' || st === 'pro-open'
  const until = st === 'pro' ? `until ${fmtDate(user.pro_until)}` : st === 'pro-open' ? 'no end date' : st === 'ended' ? `ended ${fmtDate(user.pro_until)}` : ''

  return (
    <div className={`ad-user${open ? ' ad-user-open' : ''}`}>
      <button type="button" className="ad-user-btn" onClick={onToggle} aria-expanded={open}>
        <div className="ad-user-main">
          <div className="ac-row-title ad-break">{user.email}</div>
          <div className="ac-row-sub">
            {user.full_name ? `${user.full_name} · ` : ''}{user.provider}{user.email_confirmed ? '' : ' · not confirmed'}
          </div>
        </div>
        <div className="ad-user-plan">
          <PlanPill user={user} now={now} />
          {until && <div className="ac-row-sub">{until}</div>}
          {user.price && <div className="ac-row-sub" style={user.price === 'founding' ? { color: 'var(--qh-gold)', fontWeight: 600 } : undefined}>{user.price === 'founding' ? 'Founding price' : 'Regular price'}</div>}
        </div>
        <div className="ad-user-dates ac-row-sub">
          <div>Joined {fmtDate(user.created_at)}</div>
          <div>Last in {fmtDate(user.last_sign_in_at)}</div>
        </div>
        <span className="ad-chev" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && <ManagePanel user={user} now={now} active={active} onChanged={onChanged} />}
    </div>
  )
}

function ManagePanel({ user, now, active, onChanged }: {
  user: User; now: number; active: boolean; onChanged: () => Promise<void>
}) {
  const [duration, setDuration] = useState<Duration>('1m')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Extending an active Pro with an end date adds time after that date, not after today.
  const base = active && user.pro_until ? new Date(Math.max(Date.parse(user.pro_until), now)) : new Date(now)
  const extending = active && !!user.pro_until

  function endDate(): Date | null | 'invalid' {
    if (duration === 'none') return null
    if (duration === '1m') return addMonths(base, 1)
    if (duration === '3m') return addMonths(base, 3)
    if (duration === '1y') return addMonths(base, 12)
    if (!date) return 'invalid'
    const [y, m, d] = date.split('-').map(Number)
    const end = new Date(y, m - 1, d, 23, 59, 59)
    return end.getTime() > now ? end : 'invalid'
  }
  const end = endDate()

  async function post(url: string, body: unknown, done: string) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ ok: false, text: json.error || `Failed (${res.status}).` }); return }
      setMsg({ ok: true, text: done })
      await onChanged()
    } catch {
      setMsg({ ok: false, text: 'Could not reach the server.' })
    } finally {
      setBusy(false)
    }
  }

  function givePro() {
    if (end === 'invalid') { setMsg({ ok: false, text: 'Pick an end date after today.' }); return }
    const when = end ? fmtDate(end.toISOString()) : 'no end date'
    if (!window.confirm(`${extending ? 'Extend' : 'Give'} Pro for ${user.email}\nuntil ${when}?`)) return
    void post('/api/admin/plan', { userId: user.id, status: 'pro', until: end ? end.toISOString() : null, note }, `Pro ${extending ? 'extended' : 'given'} until ${when}.`)
  }

  function removePro() {
    if (!window.confirm(`Remove Pro from ${user.email}?\nThe account goes back to Free right away.`)) return
    void post('/api/admin/plan', { userId: user.id, status: 'free', note }, 'Pro removed.')
  }

  function resendWelcome() {
    if (!window.confirm(`Send the welcome email again to ${user.email}?`)) return
    void post('/api/admin/welcome', { userId: user.id, lang }, 'Welcome email sent.')
  }

  return (
    <div className="ad-panel">
      <div className="ad-panel-block">
        <div className="ac-label">{extending ? 'Extend Pro' : active ? 'Set an end date for Pro' : 'Give Pro'}</div>
        <div className="ad-chips" role="radiogroup" aria-label="Pro length">
          {([['1m', '1 month'], ['3m', '3 months'], ['1y', '1 year'], ['date', 'Pick a date'], ['none', 'No end date']] as [Duration, string][]).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={duration === k} className={`ad-chip${duration === k ? ' ad-chip-on' : ''}`} onClick={() => setDuration(k)}>
              {label}
            </button>
          ))}
        </div>
        {duration === 'date' && (
          <input className="ac-input ad-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="End date" />
        )}
        <div className="ac-row-sub">
          {end === 'invalid' ? 'Pick an end date after today.' : end ? `Pro until ${fmtDate(end.toISOString())}` : 'Pro with no end date'}
          {extending && duration !== 'date' && duration !== 'none' ? ` (added after the current end, ${fmtDate(user.pro_until)})` : ''}
        </div>
        <input
          className="ac-input ad-note"
          type="text"
          maxLength={300}
          placeholder="Note for the log, e.g. InstaPay ref 12345"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Note"
        />
        <div className="ac-row-actions">
          <button type="button" className="ac-btn ac-btn-gold" disabled={busy} onClick={givePro}>
            {extending ? 'Extend Pro' : active ? 'Save Pro' : 'Give Pro'}
          </button>
          {active && <button type="button" className="ac-btn ac-btn-danger" disabled={busy} onClick={removePro}>Remove Pro</button>}
        </div>
      </div>

      <div className="ad-panel-block">
        <div className="ac-label">Welcome email</div>
        <div className="ac-row-sub" style={{ marginBottom: 8 }}>
          {user.welcome_sent_at ? `First sent ${fmtDate(user.welcome_sent_at, true)}` : 'Not sent automatically yet'}
        </div>
        <div className="ac-row-actions">
          <select className="ac-input ad-select" value={lang} onChange={(e) => setLang(e.target.value as 'ar' | 'en')} aria-label="Email language">
            <option value="ar">Arabic links</option>
            <option value="en">English links</option>
          </select>
          <button type="button" className="ac-btn" disabled={busy} onClick={resendWelcome}>Send again</button>
        </div>
      </div>

      <UsageBlock userId={user.id} />

      {msg && <div className={msg.ok ? 'ac-msg-ok' : 'ac-msg-err'} role="status">{msg.text}</div>}
    </div>
  )
}

interface UsageRow {
  feature: 'pdf' | 'excel' | 'save' | 'gage' | 'ai'
  tool: string
  uses: number
  first_at: string
  last_at: string
}

const FEATURE_LABEL: Record<UsageRow['feature'], string> = {
  pdf: 'PDF report',
  excel: 'Excel report',
  save: 'Saved project',
  gage: 'Gage R&R on own data',
  ai: 'AI Insights',
}

// Pro features this user has used — for the 7-day refund rule
// (/refund-policy: full refund only if no Pro feature was used).
function UsageBlock({ userId }: { userId: string }) {
  const [rows, setRows] = useState<UsageRow[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/usage?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok) { setErr(json.error || `Could not load usage (${res.status}).`); return }
        setRows(json.rows ?? [])
      })
      .catch(() => { if (alive) setErr('Could not reach the server.') })
    return () => { alive = false }
  }, [userId])

  return (
    <div className="ad-panel-block ad-usage">
      <div className="ac-label">Pro features used · for refunds</div>
      {err && <div className="ac-msg-err">{err}</div>}
      {!err && !rows && <div className="ac-row-sub">Loading…</div>}
      {rows && rows.length === 0 && <div className="ac-row-sub">No Pro feature used yet.</div>}
      {rows && rows.length > 0 && (
        <table className="ad-usage-t">
          <thead>
            <tr><th>Feature</th><th>Tool</th><th>Uses</th><th>First</th><th>Last</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.feature}-${r.tool}`}>
                <td>{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                <td className="ad-break">{r.tool}</td>
                <td>{r.uses}</td>
                <td>{fmtDate(r.first_at, true)}</td>
                <td>{fmtDate(r.last_at, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="ac-row-sub">Compare the first use with the payment date: a refund within 7 days is due only if nothing was used after paying.</div>
    </div>
  )
}

function AdminStyles() {
  return (
    <style>{`
.ad-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:18px}
.ad-h1{margin:0;font-size:24px;font-weight:700;color:var(--qh-text)}
.ad-gap{margin-top:18px}
.ad-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.ad-stat{padding:16px}
.ad-stat-v{font-size:26px;font-weight:800;line-height:1.1;color:var(--qh-text);font-variant-numeric:tabular-nums}
.ad-tools{display:flex;gap:10px;margin-bottom:6px}
.ad-tools .ac-input[type=search]{flex:1;min-width:0}
.ad-select{width:auto;min-width:150px}
.ad-list{display:flex;flex-direction:column}
.ad-user{border-top:1px solid var(--qh-border)}
.ad-user-open{background:color-mix(in srgb, var(--qh-surface2) 60%, transparent);border-radius:10px;border-top-color:transparent;margin:4px 0}
.ad-user-btn{all:unset;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr) 16px;gap:12px;align-items:center;width:100%;padding:12px 8px;cursor:pointer}
.ad-user-btn:focus-visible{outline:2px solid var(--qh-gold);outline-offset:-2px;border-radius:8px}
.ad-user-main{min-width:0}
.ad-chev{color:var(--qh-muted);font-size:12px;text-align:end}
.ad-break{overflow-wrap:anywhere;white-space:normal}
.ad-panel{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:18px;padding:4px 8px 16px}
.ad-panel-block{display:flex;flex-direction:column;gap:8px;min-width:0}
.ad-chips{display:flex;flex-wrap:wrap;gap:6px}
.ad-chip{min-height:34px;padding:0 12px;border:1px solid var(--qh-border);border-radius:999px;background:transparent;color:var(--qh-text);font:inherit;font-size:13px;cursor:pointer}
.ad-chip-on{border-color:var(--qh-gold);background:color-mix(in srgb, var(--qh-gold) 16%, transparent);font-weight:700}
.ad-date{max-width:200px}
.ad-note{max-width:420px}
.ad-panel .ac-btn[disabled]{opacity:.5;cursor:wait}
.ad-panel [role=status]{grid-column:1/-1}
.ad-usage{grid-column:1/-1}
.ad-usage-t{width:100%;border-collapse:collapse;font-size:13px}
.ad-usage-t th,.ad-usage-t td{text-align:start;padding:6px 8px;border-bottom:1px solid var(--qh-border);vertical-align:top}
.ad-usage-t th{color:var(--qh-muted);font-weight:600;font-size:12px}
@media (max-width: 900px){ .ad-stats{grid-template-columns:repeat(3,minmax(0,1fr))} }
@media (max-width: 680px){
  .ad-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ad-user-btn{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"main plan" "dates dates";row-gap:6px}
  .ad-user-main{grid-area:main}
  .ad-user-plan{grid-area:plan;text-align:end}
  .ad-user-dates{grid-area:dates;display:flex;gap:12px}
  .ad-chev{display:none}
  .ad-panel{grid-template-columns:1fr}
  .ad-tools{flex-direction:column}
  .ad-select{width:100%}
}
`}</style>
  )
}
