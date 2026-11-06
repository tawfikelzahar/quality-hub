// ─────────────────────────────────────────────────────────────────────────
// The ONE rule for "is this profile Pro right now?", used by the browser
// (lib/authState.ts) and the server (lib/pro.server.ts and the Pro routes).
//
// profiles.subscription_status = 'pro' AND (pro_until is empty OR in the
// future). Pro granted by hand from /admin carries an end date and becomes
// Free by itself once it passes. An empty pro_until means no end date.
//
// Rows are read with select('*') so this keeps working if pro_until has not
// been added yet (supabase/sql/010_admin_dashboard.sql).
// ─────────────────────────────────────────────────────────────────────────

export interface PlanRow {
  subscription_status?: string | null
  pro_until?: string | null
}

export function isProRow(row: PlanRow | null | undefined, now: number = Date.now()): boolean {
  if (!row || row.subscription_status !== 'pro') return false
  if (!row.pro_until) return true
  const until = Date.parse(row.pro_until)
  return Number.isFinite(until) && until > now
}
