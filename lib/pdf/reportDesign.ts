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

export type RGB = readonly [number, number, number]

// ── Brand palette (PDF-safe: darker/denser than the on-screen dark-mode
//    neon values, since these sit on white paper, not a dark card) ────────
export const REPORT_COLORS = {
  brand: [14, 116, 116] as RGB, // teal — matches COLORS.light.accent
  brand2: [0, 168, 150] as RGB, // matches COLORS.*.accent2
  brandDark: [6, 13, 26] as RGB,
  ink: [30, 41, 59] as RGB,
  muted: [100, 116, 139] as RGB,
  faint: [148, 163, 184] as RGB,
  border: [226, 232, 240] as RGB,
  panelTint: [236, 248, 247] as RGB,
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

  // Logo mark: rounded teal square with a white "Q"
  const markSize = 24
  setFill(pdf, REPORT_COLORS.brand)
  pdf.roundedRect(margin, y, markSize, markSize, 5, 5, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  setText(pdf, REPORT_COLORS.white)
  drawText(pdf, 'Q', margin + markSize / 2, y + markSize / 2 + 5, { align: 'center' })

  // Wordmark + tagline
  pdf.setFontSize(13)
  setText(pdf, REPORT_COLORS.brand)
  drawText(pdf, 'QUALITY HUB', margin + markSize + 8, y + 11)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  setText(pdf, REPORT_COLORS.muted)
  drawText(pdf, 'Statistical Quality Engineering', margin + markSize + 8, y + 21)

  // Meta block, right-aligned
  const now = new Date()
  const generated = now.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  setText(pdf, REPORT_COLORS.muted)
  drawText(pdf, `Generated: ${generated}`, ctx.pageWidth - margin, y + 9, { align: 'right' })
  drawText(pdf, 'qualityhub.tools', ctx.pageWidth - margin, y + 20, { align: 'right' })

  y += markSize + 20

  // Report title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(19)
  setText(pdf, REPORT_COLORS.brandDark)
  drawText(pdf, ctx.reportTitle, margin, y)
  y += 12

  // Brand rule
  setDraw(pdf, REPORT_COLORS.brand)
  pdf.setLineWidth(2)
  pdf.line(margin, y, ctx.pageWidth - margin, y)
  y += 22

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
  pdf.setFont('helvetica', 'bold')
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
  pdf.setFont('helvetica', 'bold')
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
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9.5)
  const lines = pdf.splitTextToSize(text, pageWidth - margin * 2 - 24) as string[]
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
export function interpretationBox(ctx: ReportContext, title: string, text: string, tone: CalloutTone = 'info') {
  const { pdf, margin, pageWidth } = ctx
  const { color, bg } = TONE_COLORS[tone]
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9.5)
  const lines = pdf.splitTextToSize(text, pageWidth - margin * 2 - 24) as string[]
  const h = lines.length * 13.5 + 16
  sectionHeading(ctx, title, h + 10)
  // sectionHeading() switches the active font to bold 12.5pt to draw the
  // heading and doesn't restore it — re-set it here before drawing the
  // wrapped lines, otherwise they render larger than the width they were
  // wrapped to and spill past the right edge of the box.
  pdf.setFont('helvetica', 'normal')
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
  pdf.setFont('helvetica', 'bold')
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
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    setText(pdf, REPORT_COLORS.muted)
    drawText(pdf, headers[0], x + 8, curY + baseRowH / 2 + 3)
    drawText(pdf, headers[1], x + labelW + 8, curY + baseRowH / 2 + 3)
    curY += baseRowH
  }

  drawHeaderRow()
  rows.forEach(([label, value], i) => {
    // Long values (e.g. "Subgrouped measurements (n=5)") wrap onto
    // multiple lines within the value column instead of overflowing past
    // the table's — and potentially the next table's — edge.
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    const valueLines = pdf.splitTextToSize(value, valueW) as string[]
    const rowH = Math.max(baseRowH, valueLines.length * lineH + 6)

    if (curY + rowH > ctx.pageHeight - ctx.margin - 26) {
      newPage(ctx)
      curY = ctx.y
      drawHeaderRow()
    }
    if (i % 2 === 1) {
      setFill(pdf, REPORT_COLORS.stripe)
      pdf.rect(x, curY, width, rowH, 'F')
    }
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    setText(pdf, REPORT_COLORS.muted)
    drawText(pdf, label, x + 8, curY + baseRowH / 2 + 3)
    setText(pdf, REPORT_COLORS.ink)
    pdf.setFont('helvetica', 'bold')
    const textStartY = valueLines.length > 1 ? curY + lineH + 1 : curY + baseRowH / 2 + 3
    valueLines.forEach((line, li) => drawText(pdf, line, x + labelW + 8, textStartY + li * lineH))
    pdf.setFont('helvetica', 'normal')
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
  const rowH = 18
  if (title) {
    sectionHeading(ctx, title, rowH * 2)
  } else {
    ensureSpace(ctx, rowH * 2)
  }

  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0)
  const colX: number[] = []
  let acc = margin
  columns.forEach(c => {
    colX.push(acc)
    acc += c.width
  })

  const drawHeaderRow = () => {
    setFill(pdf, REPORT_COLORS.brand)
    pdf.rect(margin, ctx.y, totalWidth, rowH, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    setText(pdf, REPORT_COLORS.white)
    columns.forEach((c, i) => {
      const tx = c.align === 'right' ? colX[i] + c.width - 6 : colX[i] + 6
      drawText(pdf, c.header, tx, ctx.y + rowH / 2 + 3, { align: c.align === 'right' ? 'right' : 'left' })
    })
    ctx.y += rowH
  }

  drawHeaderRow()
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  rows.forEach((row, i) => {
    if (ctx.y + rowH > ctx.pageHeight - ctx.margin - 26) {
      newPage(ctx)
      drawHeaderRow()
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
      pdf.setFont('helvetica', override ? 'bold' : 'normal')
      drawText(pdf, cell, tx, ctx.y + rowH / 2 + 3, { align: c.align === 'right' ? 'right' : 'left' })
      pdf.setFont('helvetica', 'normal')
    })
    ctx.y += rowH
  })

  setDraw(pdf, REPORT_COLORS.border)
  pdf.setLineWidth(0.5)
  pdf.rect(margin, ctx.y - rows.length * rowH - rowH, totalWidth, (rows.length + 1) * rowH, 'S')
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
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  setText(pdf, REPORT_COLORS.muted)
  drawText(pdf, min.toFixed(2), barX, barY + barH + 12)
  drawText(pdf, '1.00', toX(1.0), barY + barH + 12, { align: 'center' })
  drawText(pdf, '1.33', toX(1.33), barY + barH + 12, { align: 'center' })
  drawText(pdf, `${max.toFixed(2)}+`, barX + barW, barY + barH + 12, { align: 'right' })

  ctx.y = barY + barH + 26

  pdf.setFont('helvetica', 'normal')
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
    pdf.setFont('helvetica', 'bold')
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
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.5)
  setText(pdf, REPORT_COLORS.brandDark)
  drawText(pdf, title, x, y)
  let ry = y + 14
  pdf.setFontSize(7.8)
  rows.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'normal')
    setText(pdf, REPORT_COLORS.muted)
    drawText(pdf, label, x, ry)
    pdf.setFont('helvetica', 'bold')
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
  pdf.addImage(imgData, 'PNG', margin, ctx.y, imgWidth, imgHeight)
  ctx.y += imgHeight + 20
}

/** Embeds two Chart.js charts side by side, e.g. Histogram + Normal Probability Plot. */
export function addChartImagePair(
  ctx: ReportContext,
  sectionTitle: string,
  left: { chart: EmbeddableChart | null; title: string },
  right: { chart: EmbeddableChart | null; title: string }
) {
  if (!left.chart && !right.chart) return
  const { margin, pageWidth } = ctx
  const gap = 16
  const colW = (pageWidth - margin * 2 - gap) / 2

  const heights: number[] = []
  if (left.chart) heights.push((left.chart.height / left.chart.width) * colW)
  if (right.chart) heights.push((right.chart.height / right.chart.width) * colW)
  const rowHeight = Math.max(...heights, 0)

  if (sectionTitle) {
    sectionHeading(ctx, sectionTitle, rowHeight + 24)
  } else {
    ensureSpace(ctx, rowHeight + 24)
  }
  const { pdf } = ctx

  const drawOne = (item: { chart: EmbeddableChart | null; title: string }, x: number) => {
    if (!item.chart) return
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    setText(pdf, REPORT_COLORS.ink)
    drawText(pdf, item.title, x, ctx.y)
    const h = (item.chart.height / item.chart.width) * colW
    const imgData = item.chart.toBase64Image('image/png', 1)
    pdf.addImage(imgData, 'PNG', x, ctx.y + 8, colW, h)
  }

  drawOne(left, margin)
  drawOne(right, margin + colW + gap)
  ctx.y += rowHeight + 34
}

// ── Static criteria reference table ─────────────────────────────────────

/** The educational "what does this number mean" table, matching the reference report. */
export function criteriaReferenceTable(ctx: ReportContext, title = 'Capability Criteria Reference') {
  dataTable(
    ctx,
    title,
    [
      { header: 'INDEX RANGE', width: 90 },
      { header: 'CLASSIFICATION', width: 130 },
      { header: 'GENERAL INTERPRETATION', width: ctx.pageWidth - ctx.margin * 2 - 220 },
    ],
    [
      ['≥ 1.33', 'Capable Process', 'Common benchmark indicating a useful capability margin.'],
      ['1.00 to < 1.33', 'Marginal Capability', 'Process may meet specifications but has limited margin.'],
      ['< 1.00', 'Not Capable', 'Process spread and/or centering is not adequate for the specification width.'],
    ]
  )
}

// ── Footer / finalize ────────────────────────────────────────────────────

/** Draws the footer (hairline + copyright + page numbers) on every page. Call once, right before pdf.save(). */
export function finalizeReport(ctx: ReportContext) {
  const { pdf, margin, pageWidth, pageHeight } = ctx
  const pageCount = pdf.getNumberOfPages()
  const year = new Date().getFullYear()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    const fy = pageHeight - 26
    setDraw(pdf, REPORT_COLORS.border)
    pdf.setLineWidth(0.5)
    pdf.line(margin, fy, pageWidth - margin, fy)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    setText(pdf, REPORT_COLORS.faint)
    drawText(pdf, `© ${year} Quality Hub · qualityhub.tools`, margin, fy + 13)
    drawText(pdf, ctx.reportTitle, pageWidth / 2, fy + 13, { align: 'center' })
    drawText(pdf, `Page ${i} of ${pageCount}`, pageWidth - margin, fy + 13, { align: 'right' })
  }
}
