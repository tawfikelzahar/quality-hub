// ─────────────────────────────────────────────────────────────────────────
// Study details for one PDF report (Pro).
//
// Before a Pro PDF export, ExportRow (components/tool/ToolParts.tsx) opens
// ReportDetailsPanel: the person adds what the study is about (part,
// characteristic, line, period, report number), their own notes and the
// names for the sign-off. setReportDetails() keeps them here; the PDF
// builder (lib/pdf/reportDesign.ts → createReport) takes them once, so a
// later report never reuses them. Results, charts and tables are never
// edited: everything typed here is printed as the person's own text, apart
// from the site's results.
//
// Company name and logo stay on the Account page (lib/reportBranding.ts).
// ─────────────────────────────────────────────────────────────────────────

export interface ReportDetails {
  part: string
  characteristic: string
  location: string
  period: string
  reportNo: string
  notes: string
  preparedBy: string
  reviewedBy: string
  approvedBy: string
  /** print the sign-off block (Prepared / Reviewed / Approved) */
  signOff: boolean
}

export const EMPTY_REPORT_DETAILS: ReportDetails = {
  part: '', characteristic: '', location: '', period: '', reportNo: '', notes: '',
  preparedBy: '', reviewedBy: '', approvedBy: '', signOff: false,
}

/** Longest text accepted per field (notes: a paragraph or two). */
export const REPORT_DETAILS_MAX = { field: 80, notes: 1200 } as const

/** The study fields, in print order, with their English labels in the PDF. */
export const STUDY_FIELDS = [
  ['part', 'Part / Product'],
  ['characteristic', 'Characteristic'],
  ['location', 'Machine / Line'],
  ['period', 'Period / Shift'],
  ['reportNo', 'Report No.'],
] as const satisfies ReadonlyArray<readonly [keyof ReportDetails, string]>

let pending: { d: ReportDetails; at: number } | null = null
/** A report built later than this after the panel closed doesn't use the details. */
const VALID_MS = 3 * 60 * 1000

export function setReportDetails(d: ReportDetails | null) {
  pending = d ? { d: cleanDetails(d), at: Date.now() } : null
}

/** For the PDF builder: the details for this report (once), or null. */
export function takeReportDetails(): ReportDetails | null {
  const p = pending
  pending = null
  if (!p || Date.now() - p.at > VALID_MS) return null
  return p.d
}

function cleanDetails(d: ReportDetails): ReportDetails {
  const f = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, REPORT_DETAILS_MAX.field)
  return {
    part: f(d.part), characteristic: f(d.characteristic), location: f(d.location), period: f(d.period),
    reportNo: f(d.reportNo),
    // keep the person's line breaks, drop empty runs and trailing spaces
    notes: d.notes.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).join('\n')
      .replace(/\n{3,}/g, '\n\n').trim().slice(0, REPORT_DETAILS_MAX.notes),
    preparedBy: f(d.preparedBy), reviewedBy: f(d.reviewedBy), approvedBy: f(d.approvedBy),
    signOff: !!d.signOff,
  }
}

// ── Remembered between reports (this browser only) ──────────────────────
// Everything except the notes and the report number, which belong to one
// study. Storage can be missing (private mode): then nothing is remembered.
const KEY = 'qh-report-details-v1'

export function loadSavedReportDetails(): Partial<ReportDetails> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, unknown>
    const out: Partial<ReportDetails> = {}
    for (const k of ['part', 'characteristic', 'location', 'period', 'preparedBy', 'reviewedBy', 'approvedBy'] as const) {
      if (typeof o[k] === 'string') out[k] = (o[k] as string).slice(0, REPORT_DETAILS_MAX.field)
    }
    if (typeof o.signOff === 'boolean') out.signOff = o.signOff
    return out
  } catch {
    return {}
  }
}

export function saveReportDetails(d: ReportDetails) {
  try {
    const { notes: _n, reportNo: _r, ...keep } = d
    void _n; void _r
    window.localStorage.setItem(KEY, JSON.stringify(keep))
  } catch {
    /* storage unavailable: nothing remembered */
  }
}
