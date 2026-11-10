// ─────────────────────────────────────────────────────────────────────────
// Records that a signed-in user downloaded a PDF or Excel report, for the
// 7-day refund rule (/refund-policy, supabase/sql/011_pro_usage.sql).
// Called from finalizeReport (lib/pdf/reportDesign.ts) and from the Excel
// report's download (lib/excelReport.ts). Fire and forget: a failure never
// blocks the download. Sample reports (titles with "(Sample)") are skipped.
// Saving a project and Gage R&R on own data are recorded on the server.
// ─────────────────────────────────────────────────────────────────────────

export type ClientProFeature = 'pdf' | 'excel'

export function logProUsage(feature: ClientProFeature, tool: string): void {
  if (typeof window === 'undefined') return
  const name = (tool || 'unknown').slice(0, 80)
  if (/\(sample\)/i.test(name)) return
  try {
    void fetch('/api/pro-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature, tool: name }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* never block the download */
  }
}
