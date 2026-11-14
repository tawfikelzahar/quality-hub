// ─────────────────────────────────────────────────────────────────────────
// Sample reports for the public /sample-reports page.
//
// The files themselves live in public/samples/. They are NOT built here:
// each one is the tool's own PDF / Excel export, run on the tool's built-in
// example (the same "Try an example" data as on the tool page), exported as
// Pro with placeholder branding — "Your Name", "Your Company" and a dashed
// "Your Company Logo" box — so a visitor sees exactly what a subscriber gets
// and where their own details go. To make them again after a change to a
// report, see scripts/sample-reports/generate.mjs.
//
// This file keeps the list shown on the page and the branding preview used
// on the Account page.
// ─────────────────────────────────────────────────────────────────────────

import {
  createReport as createPdfReport,
  finalizeReport,
  PDF_FONT,
  REPORT_COLORS,
} from '@/lib/pdf/reportDesign'
import { SITE_SLUG } from './site'

export type SampleToolId = 'gage-rr' | 'spc' | 'oee'

export interface SampleReportMeta {
  id: SampleToolId
  nameKey: string
  descKey: string
  href: string
  /** files in public/samples/ */
  pdf: string
  excel: string
}

const file = (id: SampleToolId, ext: 'pdf' | 'xlsx') => `/samples/${SITE_SLUG}-sample-${id}-report.${ext}`

export const SAMPLE_REPORTS: SampleReportMeta[] = (
  [
    { id: 'gage-rr', nameKey: 'sample_gagerr_name', descKey: 'sample_gagerr_desc', href: '/gage-rr' },
    { id: 'spc', nameKey: 'sample_spc_name', descKey: 'sample_spc_desc', href: '/spc' },
    { id: 'oee', nameKey: 'sample_oee_name', descKey: 'sample_oee_desc', href: '/oee' },
  ] as const
).map(r => ({ ...r, pdf: file(r.id, 'pdf'), excel: file(r.id, 'xlsx') }))

// ─────────────────────────────────────────────────────────────────────────
// Branding preview — one page that shows only what the account's report
// settings control: the header (company logo or name, "Prepared by") and the
// sign-off lines, around an empty placeholder where a tool's results go.
// No sample data from any tool. Used by the "Preview" button in
// components/ReportBrandingSettings.tsx; not recorded as Pro use.
// ─────────────────────────────────────────────────────────────────────────
export function buildBrandingPreviewPdf() {
  const ctx = createPdfReport('Report Preview', 'Preview (Sample)')
  const { pdf, margin, pageWidth } = ctx
  const top = ctx.y + 6
  const height = 300
  pdf.setDrawColor(REPORT_COLORS.border[0], REPORT_COLORS.border[1], REPORT_COLORS.border[2])
  pdf.setLineWidth(1)
  pdf.setLineDashPattern([5, 4], 0)
  pdf.roundedRect(margin, top, pageWidth - margin * 2, height, 8, 8, 'S')
  pdf.setLineDashPattern([], 0)
  pdf.setFont(PDF_FONT, 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(REPORT_COLORS.muted[0], REPORT_COLORS.muted[1], REPORT_COLORS.muted[2])
  pdf.text('Your results, charts and tables appear here', pageWidth / 2, top + height / 2 - 8, { align: 'center' })
  pdf.setFont(PDF_FONT, 'normal')
  pdf.setFontSize(9.5)
  pdf.text('This page only previews your logo, your name and the sign-off lines.', pageWidth / 2, top + height / 2 + 12, { align: 'center' })
  ctx.y = top + height + 26
  finalizeReport(ctx)
  ctx.pdf.save(`${SITE_SLUG}-report-preview.pdf`)
}
