// ─────────────────────────────────────────────────────────────────────────
// Quality Hub — shared PDF report design system.
//
// Every tool's "Export PDF" button used to hand-roll its own jsPDF layout
// (see git history of SPCEngine.tsx / GageRR.tsx / etc.), which meant a
// plain, text-only report with no branding, no visual classification, and
// no charts styled beyond a raw embedded PNG. This file is the single
// place that defines what a Quality Hub PDF report *looks like* — header,
// classification badges, gauges, styled tables, callouts, footer — so any
// tool can assemble a professional report from the same building blocks.
//
// Usage in a tool component:
//   const ctx = createReport('SPC Analysis Report', 'spc')
//   classificationBanner(ctx, classifyCapability(pkVal))
//   twoColumnTables(ctx, 'Study Information', [...], 'Key Metrics', [...])
//   capabilityGauge(ctx, { value: pkVal, ... })
//   addChartImage(ctx, iChartRef.current, 'Individuals (I) Chart')
//   interpretationBox(ctx, 'Study Conclusion', '...')
//   finalizeReport(ctx)
//   ctx.pdf.save('spc-report.pdf')
//
// Design values (colors, spacing) intentionally mirror the on-screen
// capability thresholds already used in SPCEngine.tsx (capabilityColor /
// capabilityLabel: >=1.33 capable, >=1.00 marginal, else not capable) so
// the PDF never disagrees with the web UI.
// ─────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import { ARIMO_REGULAR, ARIMO_BOLD } from './fonts/arimo'
import { SITE } from '@/lib/site'
import { BRAND_LOGO_PNG, BRAND_LOGO_ASPECT } from './brandLogo'
import { getReportBranding, preparedByLine, fitBox } from '@/lib/reportBranding'

/**
 * Font family embedded in every report (see ./fonts/arimo.ts). Use this
 * instead of 'helvetica' in any direct pdf.setFont() call, so every viewer
 * (Foxit included) renders the exact same glyphs.
 */
export const PDF_FONT = 'Arimo'

function registerReportFonts(pdf: jsPDF) {
  pdf.addFileToVFS('Arimo-Regular.ttf', ARIMO_REGULAR)
  pdf.addFont('Arimo-Regular.ttf', PDF_FONT, 'normal')
  pdf.addFileToVFS('Arimo-Bold.ttf', ARIMO_BOLD)
  pdf.addFont('Arimo-Bold.ttf', PDF_FONT, 'bold')
  pdf.setFont(PDF_FONT, 'normal')
}

export type RGB = readonly [number, number, number]

// ── Brand palette (PDF-safe: darker/denser than the on-screen dark-mode
//    neon values, since these sit on white paper, not a dark card) ────────
export const REPORT_COLORS = {
  brand: [11, 31, 63] as RGB, // Mizan navy #0B1F3F (logo ink)
  brand2: [184, 148, 78] as RGB, // Mizan gold #B8944E (logo balance)
  brandDark: [6, 13, 26] as RGB,
  ink: [30, 41, 59] as RGB,
  muted: [100, 116, 139] as RGB,
  faint: [148, 163, 184] as RGB,
  border: [226, 232, 240] as RGB,
  panelTint: [238, 242, 248] as RGB, // light navy tint
  headerFill: [240, 244, 248] as RGB,
  stripe: [248, 250, 252] as RGB,
  white: [255, 255, 255] as RGB,
  // Excel's built-in "Good/Bad/Neutral" cell-style palette — instantly
  // familiar to anyone who has used conditional formatting in Excel,
  // which is exactly the audience for these reports.
  good: [0, 97, 0] as RGB, // Excel "Good" text (#006100)
  goodBg: [198, 239, 206] as RGB, // Excel "Good" fill (#C6EFCE)
  warn: [156, 101, 0] as RGB, // Excel "Neutral" text (#9C6500)
  warnBg: [255, 235, 156] as RGB, // Excel "Neutral" fill (#FFEB9C)
  bad: [156, 0, 6] as RGB, // Excel "Bad" text (#9C0006)
  badBg: [255, 199, 206] as RGB, // Excel "Bad" fill (#FFC7CE)
  neutral: [100, 116, 139] as RGB,
  neutralBg: [241, 245, 249] as RGB,
} as const

export interface Classification {
  label: string
  color: RGB
  bg: RGB
}

/**
 * Mirrors capabilityColor()/capabilityLabel() in SPCEngine.tsx exactly
 * (>=1.33 capable, >=1.00 marginal, else not capable) so a PDF report
 * never contradicts what the person already saw on screen.
 */
export function classifyCapability(val: number | null | undefined): Classification {
  if (val === null || val === undefined || !isFinite(val)) {
    return { label: 'NOT AVAILABLE', color: REPORT_COLORS.neutral, bg: REPORT_COLORS.neutralBg }
  }
  if (val >= 1.33) return { label: 'CAPABLE PROCESS', color: REPORT_COLORS.good, bg: REPORT_COLORS.goodBg }
  if (val >= 1.0) return { label: 'MARGINAL CAPABILITY', color: REPORT_COLORS.warn, bg: REPORT_COLORS.warnBg }
  return { label: 'NOT CAPABLE', color: REPORT_COLORS.bad, bg: REPORT_COLORS.badBg }
}

/**
 * Maps a Gage R&R engine's own 'okay' | 'marginal' | 'unacceptable'
 * conclusion to a Classification. Deliberately takes the app's already-
 * computed AIAG verdict rather than re-deriving thresholds here, so the
 * PDF can never disagree with what GageRR.tsx shows on screen.
 */
export function classifyGageConclusion(conclusion: 'okay' | 'marginal' | 'unacceptable'): Classification {
  if (conclusion === 'okay') return { label: 'ACCEPTABLE MEASUREMENT SYSTEM', color: REPORT_COLORS.good, bg: REPORT_COLORS.goodBg }
  if (conclusion === 'marginal') return { label: 'MARGINAL — USE WITH CAUTION', color: REPORT_COLORS.warn, bg: REPORT_COLORS.warnBg }
  return { label: 'UNACCEPTABLE MEASUREMENT SYSTEM', color: REPORT_COLORS.bad, bg: REPORT_COLORS.badBg }
}

// ── Report context ──────────────────────────────────────────────────────

export interface ReportContext {
  pdf: jsPDF
  pageWidth: number
  pageHeight: number
  margin: number
  y: number
  reportTitle: string
  toolName: string
}

function setFill(pdf: jsPDF, rgb: RGB) {
  pdf.setFillColor(rgb[0], rgb[1], rgb[2])
}
function setDraw(pdf: jsPDF, rgb: RGB) {
  pdf.setDrawColor(rgb[0], rgb[1], rgb[2])
}
function setText(pdf: jsPDF, rgb: RGB) {
  pdf.setTextColor(rgb[0], rgb[1], rgb[2])
}

// ── Unicode-safe text drawing ───────────────────────────────────────────
// jsPDF's built-in standard fonts (Helvetica, etc.) only support the
// WinAnsi/Latin-1 character set. Anything outside it — Greek letters like
// σ, math symbols like ≥, or a combining macron like the one in "X̄" —
// doesn't have a glyph and renders as mojibake (e.g. "Ã"). Every piece of
// text in this file (including strings handed in by a tool component,
// such as chart titles or formatted metric values) is funneled through
// `text()` below so this is handled in exactly one place.
const PDF_SYMBOL_MAP: Array<[RegExp, string]> = [
  [/X\u0304/g, 'X-bar'], // X̄
  [/R\u0304/g, 'R-bar'], // R̄
  [/P\u0304/g, 'P-bar'], // P̄
  [/p\u0304/g, 'p-bar'], // p̄
  [/σ/g, 'sigma'],
  [/Σ/g, 'Sigma'],
  [/≥/g, '>='],
  [/≤/g, '<='],
  [/±/g, '+/-'],
  [/×/g, 'x'],
]

export function sanitizePdfText(input: string): string {
  let s = input
  for (const [pattern, replacement] of PDF_SYMBOL_MAP) s = s.replace(pattern, replacement)
  // Strip any remaining combining diacritical marks (e.g. leftover accents).
  // Note: we deliberately do NOT strip everything outside \x00-\xFF here —
  // jsPDF's WinAnsi mapping already handles common punctuation like em/en
  // dashes (—/–), curly quotes, and the middle dot (·) correctly even
  // though their code points are above U+00FF. Only the specific symbols
  // above (Greek letters, math comparison operators) lack a glyph.
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return s
}

type TextOpts = { align?: 'left' | 'center' | 'right' }

/** Every text draw in this file goes through here so Unicode sanitization is applied exactly once. */
function drawText(pdf: jsPDF, str: string, x: number, y: number, opts?: TextOpts) {
  pdf.text(sanitizePdfText(str), x, y, opts)
}

/**
 * Starts a new A4 report: creates the jsPDF document, draws the Quality
 * Hub header (logo mark, wordmark, report title, generated timestamp,
 * brand rule), and returns a context that every other helper in this
 * file mutates (advancing `.y` as content is added).
 */
export function createReport(reportTitle: string, toolName: string): ReportContext {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  registerReportFonts(pdf)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 40
  const ctx: ReportContext = { pdf, pageWidth, pageHeight, margin, y: margin, reportTitle, toolName }
  drawHeader(ctx)
  return ctx
}

function drawHeader(ctx: ReportContext) {
  const { pdf, margin } = ctx
  let y = ctx.y

  const branding = getReportBranding()
  const markSize = 24
  if (branding && (branding.logoDataUrl || branding.company.trim())) {
    // Client branding (Pro): the customer's company logo or name replaces ours
    if (branding.logoDataUrl && branding.logoWidth > 0) {
      const fmt = branding.logoDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
      const box = fitBox(branding.logoWidth, branding.logoHeight, 150, 36)
      pdf.addImage(branding.logoDataUrl, fmt, margin, y - 6 + (36 - box.h) / 2, box.w, box.h, 'client-logo', 'FAST')
    } else {
      pdf.setFont(PDF_FONT, 'bold')
      pdf.setFontSize(14)
      setText(pdf, REPORT_COLORS.brand)
      drawText(pdf, branding.company.trim(), margin, y + 14)
    }
  } else {
    // Logo (public/brand/logo.svg, embedded as PNG — see lib/pdf/brandLogo.ts)
    const logoH = 30
    pdf.addImage(BRAND_LOGO_PNG, 'PNG', margin, y - 4, logoH * BRAND_LOGO_ASPECT, logoH, 'brand-logo', 'FAST')
  }

  // Meta block, right-aligned
  const now = new Date()
  const generated = now.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  pdf.setFont(PDF_FONT, 'normal')
  pdf.setFontSize(8.5)
  setText(pdf, REPORT_COLORS.muted)
  drawText(pdf, `Generated: ${generated}`, ctx.pageWidth - margin, y + 9, { align: 'right' })
  if (branding && branding.company.trim() && branding.logoDataUrl) {
    drawText(pdf, branding.company.trim(), ctx.pageWidth - margin, y + 20, { align: 'right' })
  } else if (!branding) {
    drawText(pdf, SITE.domain, ctx.pageWidth - margin, y + 20, { align: 'right' })
  }

  y += markSize + (branding?.logoDataUrl ? 38 : 30)

  // Report title
  pdf.setFont(PDF_FONT, 'bold')
  pdf.setFontSize(19)
  setText(pdf, REPORT_COLORS.brandDark)
  drawText(pdf, ctx.reportTitle, margin, y)
  y += 12

  // Brand rule: navy, with a short gold lead (echoes the logo's balance)
  setDraw(pdf, REPORT_COLORS.brand)
  pdf.setLineWidth(2)
  pdf.line(margin, y, ctx.pageWidth - margin, y)
  setDraw(pdf, REPORT_COLORS.brand2)
  pdf.line(margin, y, margin + 56, y)
  y += 22

  // "Prepared by" line (client branding)
  if (branding && preparedByLine(branding)) {
    pdf.setFont(PDF_FONT, 'normal')
    pdf.setFontSize(9)
    setText(pdf, REPORT_COLORS.muted)
    drawText(pdf, `Prepared by: ${preparedByLine(branding)}`, margin, y - 6)
    y += 12
  }

  ctx.y = y
}

/**
 * Pushes to a new page (used both automatically by ensureSpace and
 * manually) and resets `.y` to the top margin. Unlike the header, this
 * does not redraw the branding — matches the reference report, where the
 * masthead only appears once and subsequent pages start with content.
 */
export function newPage(ctx: ReportContext) {
  ctx.pdf.addPage()
  ctx.y = ctx.margin
}

/** Adds a page break if the next block of `neededHeight` wouldn't fit. */
export function ensureSpace(ctx: ReportContext, neededHeight: number) {
  if (ctx.y + neededHeight > ctx.pageHeight - ctx.margin - 26) {
    newPage(ctx)
  }
}

/**
 * A bold section heading with a thin rule underneath (e.g. "Process
 * Stability Assessment"). Pass `reserveBelow` (the height in points of
 * whatever content immediately follows) so the page-break check accounts
 * for the heading *and* its content together — otherwise a heading can
 * end up alone at the bottom of a page while its chart/table gets pushed
 * to the next one.
 */
export function sectionHeading(ctx: ReportContext, text: string, reserveBelow = 0) {
  ensureSpace(ctx, 26 + reserveBelow)
  const { pdf, margin } = ctx
  pdf.setFont(PDF_FONT, 'bold')
  pdf.setFontSize(12.5)
  setText(pdf, REPORT_COLORS.brandDark)
  drawText(pdf, text, margin, ctx.y)
  ctx.y += 6
  setDraw(pdf, REPORT_COLORS.border)
  pdf.setLineWidth(0.75)
  pdf.line(margin, ctx.y, ctx.pageWidth - margin, ctx.y)
  ctx.y += 14
}

/**
 * Full-width classification banner directly under the header, e.g.
 * "Capability Classification: MARGINAL CAPABILITY" — mirrors the
 * light-tint banner competitors use so the verdict is visible before
 * reading a single number.
 */
export function classificationBanner(ctx: ReportContext, cls: Classification, prefix = 'Capability Classification') {
  ensureSpace(ctx, 34)
  const { pdf, margin, pageWidth } = ctx
  const w = pageWidth - margin * 2
  const h = 26
  setFill(pdf, cls.bg)
  pdf.rect(margin, ctx.y, w, h, 'F')
  setFill(pdf, cls.color)
  pdf.rect(margin, ctx.y, 4, h, 'F')
  pdf.setFont(PDF_FONT, 'bold')
  pdf.setFontSize(11)
  setText(pdf, cls.color)
  drawText(pdf, `${prefix}: ${cls.label}`, margin + 14, ctx.y + h / 2 + 4)
  ctx.y += h + 18
}

export type CalloutTone = 'info' | 'good' | 'warn' | 'bad'

const TONE_COLORS: Record<CalloutTone, { color: RGB; bg: RGB }> = {
  info: { color: REPORT_COLORS.brand, bg: REPORT_COLORS.panelTint },
  good: { color: REPORT_COLORS.good, bg: REPORT_COLORS.goodBg },
  warn: { color: REPORT_COLORS.warn, bg: REPORT_COLORS.warnBg },
  bad: { color: REPORT_COLORS.bad, bg: REPORT_COLORS.badBg },
}

/** A short one-line status callout, e.g. "No Nelson Rule violations — process in statistical control." */
export function calloutBox(ctx: ReportContext, text: string, tone: CalloutTone = 'info') {
  const { pdf, margin, pageWidth } = ctx
  const { color, bg } = TONE_COLORS[tone]
  pdf.setFont(PDF_FONT, 'normal')
  pdf.setFontSize(9.5)
  const lines = pdf.splitTextToSize(sanitizePdfText(text), pageWidth - margin * 2 - 24) as string[]
  const h = lines.length * 13 + 14
  ensureSpace(ctx, h + 8)
  setFill(pdf, bg)
  pdf.rect(margin, ctx.y, pageWidth - margin * 2, h, 'F')
  setFill(pdf, color)
  pdf.rect(margin, ctx.y, 3, h, 'F')
  setText(pdf, REPORT_COLORS.ink)
  lines.forEach((line, i) => drawText(pdf, line, margin + 13, ctx.y + 17 + i * 13))
  ctx.y += h + 16
}

/**
 * A titled, left-bordered narrative box for auto-generated interpretation
 * text (e.g. "Study Conclusion"). Wraps to as many lines as needed and
 * paginates automatically.
 */
/**
 * Short labelled summary on page 1 (e.g. Stability / Capability / Action /
 * Data), so a manager or customer gets the answer without reading to the
 * last page. Labels in bold on the left, wrapped text on the right.
 */
export function summaryBox(ctx: ReportContext, title: string, rows: Array<[string, string]>, tone: CalloutTone = 'info') {
  if (rows.length === 0) return
  const { pdf, margin, pageWidth } = ctx
  const { color, bg } = TONE_COLORS[tone]
  const labelW = 78
  const textW = pageWidth - margin * 2 - 13 - labelW - 12
  const lineH = 13
  pdf.setFont(PDF_FONT, 'normal')
  pdf.setFontSize(9.5)
  const wrapped = rows.map(([, text]) => pdf.splitTextToSize(sanitizePdfText(text), textW) as string[])
  const h = wrapped.reduce((sum, l) => sum + l.length * lineH + 4, 0) + 14
  sectionHeading(ctx, title, h + 10)
  setFill(pdf, bg)
  pdf.rect(margin, ctx.y, pageWidth - margin * 2, h, 'F')
  setFill(pdf, color)
  pdf.rect(margin, ctx.y, 3, h, 'F')
  let y = ctx.y + 17
  rows.forEach(([label], i) => {
    pdf.setFont(PDF_FONT, 'bold')
    pdf.setFontSize(9.5)
    setText(pdf, REPORT_COLORS.ink)
    drawText(pdf, label, margin + 13, y)
    pdf.setFont(PDF_FONT, 'normal')
    wrapped[i].forEach((line, li) => drawText(pdf, line, margin + 13 + labelW, y + li * lineH))
    y += wrapped[i].length * lineH + 4
  })
  ctx.y += h + 18
}

export function interpretationBox(ctx: ReportContext, title: string, text: string, tone: CalloutTone = 'info') {
  const { pdf, margin, pageWidth } = ctx
  const { color, bg } = TONE_COLORS[tone]
  pdf.setFont(PDF_FONT, 'normal')
  pdf.setFontSize(9.5)
  const lines = pdf.splitTextToSize(sanitizePdfText(text), pageWidth - margin * 2 - 24) as string[]
  const h = lines.length * 13.5 + 16
  sectionHeading(ctx, title, h + 10)
  // sectionHeading() switches the active font to bold 12.5pt to draw the
  // heading and doesn't restore it — re-set it here before drawing the
  // wrapped lines, otherwise they render larger than the width they were
  // wrapped to and spill past the right edge of the box.
  pdf.setFont(PDF_FONT, 'normal')
  pdf.setFontSize(9.5)
  setFill(pdf, bg)
  pdf.rect(margin, ctx.y, pageWidth - margin * 2, h, 'F')
  setFill(pdf, color)
  pdf.rect(margin, ctx.y, 3, h, 'F')
  setText(pdf, REPORT_COLORS.ink)
  lines.forEach((line, i) => drawText(pdf, line, margin + 13, ctx.y + 18 + i * 13.5))
  ctx.y += h + 18
}

// ── Tables ───────────────────────────────────────────────────────────────

export type KVRow = readonly [string, string]

/**
 * Two side-by-side key/value tables sharing one row of section titles
 * (e.g. "Study Information" | "Key Metrics"), matching the reference
 * report's layout. Both tables advance to the taller of the two.
 */
export function twoColumnTables(
  ctx: ReportContext,
  leftTitle: string,
  leftRows: KVRow[],
  rightTitle: string,
  rightRows: KVRow[]
) {
  const { pdf, margin, pageWidth } = ctx
  const gap = 20
  const colW = (pageWidth - margin * 2 - gap) / 2
  const startY = ctx.y

  ensureSpace(ctx, 24 + 17) // titles + their tables' header row, kept together
  pdf.setFont(PDF_FONT, 'bold')
  pdf.setFontSize(11)
  setText(pdf, REPORT_COLORS.brandDark)
  drawText(pdf, leftTitle, margin, ctx.y)
  drawText(pdf, rightTitle, margin + colW + gap, ctx.y)
  ctx.y += 12

  const afterTitlesY = ctx.y
  const leftBottom = drawKVTable(ctx, margin, afterTitlesY, colW, leftRows, ['ITEM', 'VALUE'])
  ctx.y = afterTitlesY // reset so the right column starts level with the left
  const rightBottom = drawKVTable(ctx, margin + colW + gap, afterTitlesY, colW, rightRows, ['METRIC', 'VALUE'])

  ctx.y = Math.max(leftBottom, rightBottom) + 18
  void startY
}

/** Draws one key/value table at a fixed (x, y) and returns the y just below it. Handles pagination and long-value wrapping on its own. */
function drawKVTable(ctx: ReportContext, x: number, y: number, width: number, rows: KVRow[], headers: [string, string]): number {
  const { pdf } = ctx
  const baseRowH = 17
  const lineH = 11
  const labelW = width * 0.55
  const valueW = width - labelW - 16
  let curY = y

  const drawHeaderRow = () => {
    setFill(pdf, REPORT_COLORS.headerFill)
    pdf.rect(x, curY, width, baseRowH, 'F')
    pdf.setFont(PDF_FONT, 'bold')
    pdf.setFontSize(8)
    setText(pdf, REPORT_COLORS.muted)
    drawText(pdf, headers[0], x + 8, curY + baseRowH / 2 + 3)
    drawText(pdf, headers[1], x + labelW + 8, curY + baseRowH / 2 + 3)
    curY += baseRowH
  }

  drawHeaderRow()
  rows.forEach(([label, value], i) => {
    // Long labels (e.g. "Number of Distinct Categories (ndc)") and long
    // values (e.g. "Subgrouped measurements (n=5)") both wrap onto
    // multiple lines within their own column instead of overflowing into
    // each other or past the table's edge.
    pdf.setFont(PDF_FONT, 'normal')
    pdf.setFontSize(9)
    const labelLines = pdf.splitTextToSize(sanitizePdfText(label), labelW - 8) as string[]
    pdf.setFont(PDF_FONT, 'bold')
    const valueLines = pdf.splitTextToSize(sanitizePdfText(value), valueW) as string[]
    const rowH = Math.max(baseRowH, Math.max(labelLines.length, valueLines.length) * lineH + 6)

    if (curY + rowH > ctx.pageHeight - ctx.margin - 26) {
      newPage(ctx)
      curY = ctx.y
      drawHeaderRow()
    }
    if (i % 2 === 1) {
      setFill(pdf, REPORT_COLORS.stripe)
      pdf.rect(x, curY, width, rowH, 'F')
    }
    pdf.setFont(PDF_FONT, 'normal')
    pdf.setFontSize(9)
    setText(pdf, REPORT_COLORS.muted)
    const labelStartY = labelLines.length > 1 ? curY + lineH + 1 : curY + baseRowH / 2 + 3
    labelLines.forEach((line, li) => drawText(pdf, line, x + 8, labelStartY + li * lineH))
    setText(pdf, REPORT_COLORS.ink)
    pdf.setFont(PDF_FONT, 'bold')
    const valueStartY = valueLines.length > 1 ? curY + lineH + 1 : curY + baseRowH / 2 + 3
    valueLines.forEach((line, li) => drawText(pdf, line, x + labelW + 8, valueStartY + li * lineH))
    pdf.setFont(PDF_FONT, 'normal')
    curY += rowH
  })

  setDraw(pdf, REPORT_COLORS.border)
  pdf.setLineWidth(0.5)
  pdf.rect(x, y, width, curY - y, 'S')

  return curY
}

export interface DataTableColumn {
  header: string
  width: number // points
  align?: 'left' | 'right' | 'center'
}

export interface DataTableOptions {
  /** Optional per-cell text color override, same [row][col] shape as `rows`. Falls back to ink when omitted/null. */
  cellColors?: (RGB | null)[][]
}

/**
 * Generic multi-column data table (Nelson Rule Violations, PPM Estimates,
 * Capability Classification Summary, ...) with a repeating header on
 * page breaks and zebra striping.
 */
export function dataTable(ctx: ReportContext, title: string, columns: DataTableColumn[], rows: string[][], options?: DataTableOptions) {
  const { pdf, margin } = ctx
  const baseRowH = 18
  const lineH = 11
  const cellPadding = 12

  // Measure the whole table first. A short table (up to ~60% of a page) is
  // kept together: if it does not fit below the current position it starts
  // on the next page instead of leaving 2-3 orphan rows behind. Long data
  // tables still flow across pages with a repeated header.
  const measure = (text: string, width: number, bold: boolean) => {
    pdf.setFont(PDF_FONT, bold ? 'bold' : 'normal')
    pdf.setFontSize(8.5)
    return (pdf.splitTextToSize(sanitizePdfText(text), width - cellPadding) as string[]).length
  }
  const headerH = Math.max(baseRowH, Math.max(...columns.map(c => measure(c.header, c.width, true))) * lineH + 7)
  const bodyH = rows.reduce((sum, row, i) => {
    const maxLines = Math.max(...row.map((cell, j) => measure(cell, columns[j].width, !!options?.cellColors?.[i]?.[j])))
    return sum + Math.max(baseRowH, maxLines * lineH + 7)
  }, 0)
  const usablePage = ctx.pageHeight - ctx.margin * 2 - 26
  const keepTogether = headerH + bodyH <= usablePage * 0.6
  const reserve = keepTogether ? headerH + bodyH : baseRowH * 2

  if (title) {
    sectionHeading(ctx, title, reserve)
  } else {
    ensureSpace(ctx, reserve)
  }

  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0)
  const colX: number[] = []
  let acc = margin
  columns.forEach(c => {
    colX.push(acc)
    acc += c.width
  })
  const cellPad = 12 // 6pt padding each side, matches the 6pt text inset used below

  const drawHeaderRow = () => {
    pdf.setFont(PDF_FONT, 'bold')
    pdf.setFontSize(8.5)
    // Headers wrap too — defends against a header like "P-VALUE" or a
    // translated label being wider than its column.
    const headerLines = columns.map(c => pdf.splitTextToSize(sanitizePdfText(c.header), c.width - cellPad) as string[])
    const hRowH = Math.max(baseRowH, Math.max(...headerLines.map(l => l.length)) * lineH + 7)
    setFill(pdf, REPORT_COLORS.brand)
    pdf.rect(margin, ctx.y, totalWidth, hRowH, 'F')
    setText(pdf, REPORT_COLORS.white)
    columns.forEach((c, i) => {
      const tx = c.align === 'right' ? colX[i] + c.width - 6 : colX[i] + 6
      const lines = headerLines[i]
      const startY = lines.length > 1 ? ctx.y + lineH + 1 : ctx.y + hRowH / 2 + 3
      lines.forEach((line, li) => drawText(pdf, line, tx, startY + li * lineH, { align: c.align === 'right' ? 'right' : 'left' }))
    })
    ctx.y += hRowH
  }

  drawHeaderRow()
  let segmentTop = ctx.y // top of the table body currently visible on this page, for the border box

  rows.forEach((row, i) => {
    // Wrap every cell to its column width — a long sentence (e.g. in a
    // "GENERAL INTERPRETATION" column) breaks onto multiple lines instead
    // of running off the edge of the page, and the row grows to fit.
    const cellLines: string[][] = row.map((cell, j) => {
      const c = columns[j]
      const override = options?.cellColors?.[i]?.[j]
      pdf.setFont(PDF_FONT, override ? 'bold' : 'normal')
      pdf.setFontSize(8.5)
      return pdf.splitTextToSize(sanitizePdfText(cell), c.width - cellPad) as string[]
    })
    const rowH = Math.max(baseRowH, Math.max(...cellLines.map(l => l.length)) * lineH + 7)

    if (ctx.y + rowH > ctx.pageHeight - ctx.margin - 26) {
      setDraw(pdf, REPORT_COLORS.border)
      pdf.setLineWidth(0.5)
      pdf.rect(margin, segmentTop, totalWidth, ctx.y - segmentTop, 'S')
      newPage(ctx)
      drawHeaderRow()
      segmentTop = ctx.y
    }
    if (i % 2 === 1) {
      setFill(pdf, REPORT_COLORS.stripe)
      pdf.rect(margin, ctx.y, totalWidth, rowH, 'F')
    }
    row.forEach((cell, j) => {
      const c = columns[j]
      const tx = c.align === 'right' ? colX[j] + c.width - 6 : colX[j] + 6
      const override = options?.cellColors?.[i]?.[j]
      setText(pdf, override ?? REPORT_COLORS.ink)
      pdf.setFont(PDF_FONT, override ? 'bold' : 'normal')
      const lines = cellLines[j]
      const startY = lines.length > 1 ? ctx.y + lineH + 1 : ctx.y + rowH / 2 + 3
      lines.forEach((line, li) => drawText(pdf, line, tx, startY + li * lineH, { align: c.align === 'right' ? 'right' : 'left' }))
    })
    pdf.setFont(PDF_FONT, 'normal')
    ctx.y += rowH
  })

  setDraw(pdf, REPORT_COLORS.border)
  pdf.setLineWidth(0.5)
  pdf.rect(margin, segmentTop, totalWidth, ctx.y - segmentTop, 'S')
  ctx.y += 16
}

// ── Capability gauge ────────────────────────────────────────────────────

export interface GaugeBand {
  upTo: number
  color: RGB
}

/**
 * The horizontal capability gauge — a colored band from `min` to `max`
 * (default red/amber/green at the standard 1.00 / 1.33 Cpk thresholds)
 * with a black pointer marking `value`, mirroring a Minitab-style
 * capability gauge.
 */
export function capabilityGauge(
  ctx: ReportContext,
  opts: {
    title?: string
    value: number | null
    min?: number
    max?: number
    bands?: GaugeBand[]
    /** Axis tick marks. Defaults to the SPC capability scale (0 / 1.00 / 1.33 / max+) if omitted. */
    ticks?: { value: number; label: string }[]
    caption: string
  }
) {
  const min = opts.min ?? 0
  const max = opts.max ?? 2
  const bands: GaugeBand[] =
    opts.bands ??
    [
      { upTo: 1.0, color: REPORT_COLORS.badBg },
      { upTo: 1.33, color: REPORT_COLORS.warnBg },
      { upTo: max, color: REPORT_COLORS.goodBg },
    ]
  const ticks =
    opts.ticks ??
    [
      { value: min, label: min.toFixed(2) },
      { value: 1.0, label: '1.00' },
      { value: 1.33, label: '1.33' },
      { value: max, label: `${max.toFixed(2)}+` },
    ]

  if (opts.title) {
    sectionHeading(ctx, opts.title, 70)
  } else {
    ensureSpace(ctx, 70)
  }
  const { pdf, margin, pageWidth } = ctx
  const barX = margin
  const barW = pageWidth - margin * 2
  const barY = ctx.y
  const barH = 16

  const clampedValue = opts.value === null || !isFinite(opts.value) ? null : Math.max(min, Math.min(max, opts.value))
  const toX = (v: number) => barX + ((v - min) / (max - min)) * barW

  // Colored bands
  let prev = min
  pdf.setLineWidth(0)
  bands.forEach(band => {
    const to = Math.min(band.upTo, max)
    setFill(pdf, band.color)
    pdf.rect(toX(prev), barY, Math.max(0, toX(to) - toX(prev)), barH, 'F')
    prev = to
  })
  // Rounded caps: mask corners with a thin white round-rect outline for a softer look
  setDraw(pdf, REPORT_COLORS.white)
  pdf.setLineWidth(1.5)
  pdf.roundedRect(barX, barY, barW, barH, 4, 4, 'S')
  // A subtle border keeps the pastel bands from looking washed out against the white page.
  setDraw(pdf, REPORT_COLORS.border)
  pdf.setLineWidth(0.75)
  pdf.roundedRect(barX, barY, barW, barH, 4, 4, 'S')

  // Pointer
  if (clampedValue !== null) {
    const px = toX(clampedValue)
    setFill(pdf, REPORT_COLORS.brandDark)
    pdf.triangle(px - 5, barY - 7, px + 5, barY - 7, px, barY - 1, 'F')
    pdf.rect(px - 1, barY, 2, barH, 'F')
  }

  // Axis labels
  pdf.setFont(PDF_FONT, 'normal')
  pdf.setFontSize(7.5)
  setText(pdf, REPORT_COLORS.muted)
  ticks.forEach((t, i) => {
    const align: 'left' | 'center' | 'right' = i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center'
    drawText(pdf, t.label, toX(t.value), barY + barH + 12, { align })
  })

  ctx.y = barY + barH + 26

  pdf.setFont(PDF_FONT, 'normal')
  pdf.setFontSize(8.5)
  setText(pdf, REPORT_COLORS.ink)
  drawText(pdf, opts.caption, margin, ctx.y)
  ctx.y += 20
}

// ── Capability comparison plot (Specs / Within / Overall bars) ─────────

export interface CapabilityBarsOptions {
  lsl: number | null
  usl: number | null
  mean: number
  sigmaWithin: number | null
  sigmaOverall: number | null
  withinStats: KVRow[]
  overallStats: KVRow[]
}

/**
 * Three horizontal bars comparing the specification spread against the
 * within- and overall-sigma process spread (mean ± 3σ), the same visual
 * competitors use to show capability at a glance. Small stat panels sit
 * on either side, matching the reference report's "Within" / "Overall"
 * side tables.
 */
export function capabilityComparisonPlot(ctx: ReportContext, title: string, opts: CapabilityBarsOptions) {
  const panelW = 100
  const rowH = 20
  const gap = 14
  const blockH = rowH * 3 + gap * 2 + 20
  sectionHeading(ctx, title, blockH + 20)
  const { pdf, margin, pageWidth } = ctx
  const plotX = margin + panelW + 12
  const plotW = pageWidth - margin * 2 - panelW * 2 - 24

  const specsLo = opts.lsl
  const specsHi = opts.usl
  const withinLo = opts.sigmaWithin !== null ? opts.mean - 3 * opts.sigmaWithin : null
  const withinHi = opts.sigmaWithin !== null ? opts.mean + 3 * opts.sigmaWithin : null
  const overallLo = opts.sigmaOverall !== null ? opts.mean - 3 * opts.sigmaOverall : null
  const overallHi = opts.sigmaOverall !== null ? opts.mean + 3 * opts.sigmaOverall : null

  const candidates = [specsLo, specsHi, withinLo, withinHi, overallLo, overallHi].filter((v): v is number => v !== null)
  const dataMin = Math.min(...candidates)
  const dataMax = Math.max(...candidates)
  const pad = (dataMax - dataMin) * 0.08 || 1
  const scaleMin = dataMin - pad
  const scaleMax = dataMax + pad
  const toX = (v: number) => plotX + ((v - scaleMin) / (scaleMax - scaleMin)) * plotW

  const top = ctx.y

  const drawBar = (label: string, lo: number | null, hi: number | null, rowY: number) => {
    pdf.setFont(PDF_FONT, 'bold')
    pdf.setFontSize(8.5)
    setText(pdf, REPORT_COLORS.ink)
    drawText(pdf, label, plotX + plotW / 2, rowY - 5, { align: 'center' })
    setDraw(pdf, REPORT_COLORS.brand)
    pdf.setLineWidth(2)
    if (lo !== null && hi !== null) {
      pdf.line(toX(lo), rowY, toX(hi), rowY)
      pdf.line(toX(lo), rowY - 5, toX(lo), rowY + 5)
      pdf.line(toX(hi), rowY - 5, toX(hi), rowY + 5)
    } else {
      pdf.setFontSize(7.5)
      setText(pdf, REPORT_COLORS.faint)
      drawText(pdf, 'n/a', plotX + plotW / 2, rowY + 4, { align: 'center' })
    }
  }

  drawBar('Overall', overallLo, overallHi, top + 20)
  drawBar('Within', withinLo, withinHi, top + 20 + rowH + gap)
  drawBar('Specs', specsLo, specsHi, top + 20 + (rowH + gap) * 2)

  // Panel border
  setDraw(pdf, REPORT_COLORS.border)
  pdf.setLineWidth(0.75)
  pdf.roundedRect(margin, top, pageWidth - margin * 2, blockH, 4, 4, 'S')

  // Left panel: Within stats
  drawStatPanel(ctx, margin + 10, top + 14, panelW - 10, 'Within', opts.withinStats)
  // Right panel: Overall stats
  drawStatPanel(ctx, pageWidth - margin - panelW, top + 14, panelW - 10, 'Overall', opts.overallStats)

  ctx.y = top + blockH + 18
}

function drawStatPanel(ctx: ReportContext, x: number, y: number, width: number, title: string, rows: KVRow[]) {
  const { pdf } = ctx
  pdf.setFont(PDF_FONT, 'bold')
  pdf.setFontSize(8.5)
  setText(pdf, REPORT_COLORS.brandDark)
  drawText(pdf, title, x, y)
  let ry = y + 14
  pdf.setFontSize(7.8)
  rows.forEach(([label, value]) => {
    pdf.setFont(PDF_FONT, 'normal')
    setText(pdf, REPORT_COLORS.muted)
    drawText(pdf, label, x, ry)
    pdf.setFont(PDF_FONT, 'bold')
    setText(pdf, REPORT_COLORS.ink)
    drawText(pdf, value, x + width, ry, { align: 'right' })
    ry += 12
  })
}

// ── Charts (Chart.js canvas → embedded PNG) ─────────────────────────────

interface EmbeddableChart {
  width: number
  height: number
  toBase64Image: (type?: string, quality?: number) => string
}

/** Embeds a full-width Chart.js chart as a PNG, with a section-style title above it. */
export function addChartImage(ctx: ReportContext, chart: EmbeddableChart | null, title: string) {
  if (!chart) return
  const { margin, pageWidth } = ctx
  const imgWidth = pageWidth - margin * 2
  const imgHeight = (chart.height / chart.width) * imgWidth
  sectionHeading(ctx, title, imgHeight)
  const { pdf } = ctx
  const imgData = chart.toBase64Image('image/png', 1)
  // 'FAST' = lossless deflate. Without it jsPDF stores raw pixels: a single
  // retina chart was ~5 MB uncompressed vs ~25 KB compressed, same render.
  pdf.addImage(imgData, 'PNG', margin, ctx.y, imgWidth, imgHeight, undefined, 'FAST')
  ctx.y += imgHeight + 20
}

/**
 * Embeds two related Chart.js charts (e.g. I chart + MR chart) under one
 * section heading, stacked at full page width. They used to sit side by
 * side, which shrank chart labels to ~3 pt in print; at full width the
 * labels stay around 7-8 pt.
 */
export function addChartImagePair(
  ctx: ReportContext,
  sectionTitle: string,
  left: { chart: EmbeddableChart | null; title: string },
  right: { chart: EmbeddableChart | null; title: string }
) {
  const items = [left, right].filter((i): i is { chart: EmbeddableChart; title: string } => !!i.chart)
  if (items.length === 0) return
  const { margin, pageWidth } = ctx
  const w = pageWidth - margin * 2
  const heightOf = (c: EmbeddableChart) => (c.height / c.width) * w

  if (sectionTitle) {
    sectionHeading(ctx, sectionTitle, heightOf(items[0].chart) + 24)
  } else {
    ensureSpace(ctx, heightOf(items[0].chart) + 24)
  }
  const { pdf } = ctx

  items.forEach((item, idx) => {
    const h = heightOf(item.chart)
    if (idx > 0) ensureSpace(ctx, h + 24)
    pdf.setFont(PDF_FONT, 'bold')
    pdf.setFontSize(9)
    setText(pdf, REPORT_COLORS.ink)
    drawText(pdf, item.title, margin, ctx.y)
    const imgData = item.chart.toBase64Image('image/png', 1)
    pdf.addImage(imgData, 'PNG', margin, ctx.y + 8, w, h, undefined, 'FAST')
    ctx.y += h + 22
  })
  ctx.y += 12
}

// ── Static criteria reference table ─────────────────────────────────────

/** The educational "what does this number mean" table, matching the reference report. */
const CPK_CRITERIA_ROWS: string[][] = [
  ['≥ 1.33', 'Capable Process', 'Common benchmark indicating a useful capability margin.'],
  ['1.00 to < 1.33', 'Marginal Capability', 'Process may meet specifications but has limited margin.'],
  ['< 1.00', 'Not Capable', 'Process spread and/or centering is not adequate for the specification width.'],
]

/**
 * The educational "what does this number mean" reference table. Defaults
 * to the SPC Cpk/Ppk criteria (matching the reference report this design
 * system was modeled on); pass `rows` for other tools whose acceptance
 * bands differ (e.g. Gage R&R's %GRR of tolerance).
 */
export function criteriaReferenceTable(
  ctx: ReportContext,
  title = 'Capability Criteria Reference',
  rows: string[][] = CPK_CRITERIA_ROWS,
  headers: [string, string, string] = ['INDEX RANGE', 'CLASSIFICATION', 'GENERAL INTERPRETATION']
) {
  dataTable(
    ctx,
    title,
    [
      { header: headers[0], width: 90 },
      { header: headers[1], width: 150 },
      { header: headers[2], width: ctx.pageWidth - ctx.margin * 2 - 240 },
    ],
    rows
  )
}

// ── Footer / finalize ────────────────────────────────────────────────────

/** Draws the footer (hairline + copyright + page numbers) on every page. Call once, right before pdf.save(). */
export function finalizeReport(ctx: ReportContext) {
  const branding = getReportBranding()
  if (branding && branding.showSignatures) drawSignatureBlock(ctx, branding.preparedBy.trim())
  const { pdf, margin, pageWidth, pageHeight } = ctx
  const pageCount = pdf.getNumberOfPages()
  const year = new Date().getFullYear()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    const fy = pageHeight - 26
    setDraw(pdf, REPORT_COLORS.border)
    pdf.setLineWidth(0.5)
    pdf.line(margin, fy, pageWidth - margin, fy)
    pdf.setFont(PDF_FONT, 'normal')
    pdf.setFontSize(7.5)
    setText(pdf, REPORT_COLORS.faint)
    drawText(pdf, branding ? `Generated with ${SITE.name} · ${SITE.domain}` : `© ${year} ${SITE.name} · ${SITE.domain}`, margin, fy + 13)
    drawText(pdf, ctx.reportTitle, pageWidth / 2, fy + 13, { align: 'center' })
    drawText(pdf, `Page ${i} of ${pageCount}`, pageWidth - margin, fy + 13, { align: 'right' })
  }
}

/** "Prepared by / Approved by" sign-off at the end of a branded report. */
function drawSignatureBlock(ctx: ReportContext, preparedBy: string) {
  ensureSpace(ctx, 92)
  const { pdf, margin, pageWidth } = ctx
  const colW = (pageWidth - margin * 2 - 30) / 2
  let y = ctx.y + 14
  pdf.setFont(PDF_FONT, 'bold')
  pdf.setFontSize(11)
  setText(pdf, REPORT_COLORS.brandDark)
  drawText(pdf, 'Sign-off', margin, y)
  y += 24
  const cols: [string, string][] = [['Prepared by', preparedBy], ['Approved by', '']]
  cols.forEach(([label, name], i) => {
    const x = margin + i * (colW + 30)
    pdf.setFont(PDF_FONT, 'bold')
    pdf.setFontSize(8.5)
    setText(pdf, REPORT_COLORS.muted)
    drawText(pdf, label.toUpperCase(), x, y)
    pdf.setFont(PDF_FONT, 'normal')
    pdf.setFontSize(10)
    setText(pdf, REPORT_COLORS.ink)
    if (name) drawText(pdf, name, x, y + 16)
    setDraw(pdf, REPORT_COLORS.faint)
    pdf.setLineWidth(0.6)
    pdf.line(x, y + 40, x + colW * 0.62, y + 40)
    pdf.line(x + colW * 0.7, y + 40, x + colW, y + 40)
    pdf.setFontSize(7.5)
    setText(pdf, REPORT_COLORS.faint)
    drawText(pdf, 'Signature', x, y + 50)
    drawText(pdf, 'Date', x + colW * 0.7, y + 50)
  })
  ctx.y = y + 62
}
