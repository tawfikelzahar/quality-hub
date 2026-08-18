// ─────────────────────────────────────────────────────────────────────────
// Quality Hub — shared professional Excel report builder
// ─────────────────────────────────────────────────────────────────────────
// Every tool's exportExcel() used to call XLSX.utils.json_to_sheet() (from
// the 'xlsx' package), which produces a flat, completely unstyled sheet —
// no colors, no borders, no bold headers, no column widths. The 'xlsx'
// community package cannot write cell styles at all, so no amount of data
// shaping fixes that; it needs a different writer.
//
// This file uses 'exceljs' (which DOES support styling, freeze panes, and
// number formats) to give every tool the same professional report look:
// a branded title band, a metadata strip, bordered+striped tables with a
// colored header row, KPI cards, conditional pass/fail/violation coloring,
// auto-sized columns, and a footer. Tools still use 'xlsx' to *read*
// uploaded files — only the writing path changes.
//
// Usage pattern (see components/SPCEngine.tsx for a full example):
//
//   const report = createReport({ toolName: 'SPC Engine', subtitle: '...' })
//   const sheet = report.addSheet('Summary')
//   sheet.kpiRow([{ label: 'Cpk', value: '1.33', tone: 'good' }, ...])
//   sheet.table({ headers: [...], rows: [...] })
//   await report.download('spc-report.xlsx')
// ─────────────────────────────────────────────────────────────────────────

import ExcelJS from 'exceljs'

// ── Brand palette (from lib/theme.ts COLORS.dark — used regardless of the
// UI theme the person currently has selected, so exported files always
// look the same) ────────────────────────────────────────────────────────
export const BRAND = {
  accent: '0FD4C8',      // teal
  accent2: '00A896',     // teal-green (gradient partner)
  navy: '0A0F1E',        // dark bg — used for the title band
  navy2: '111827',       // surface
  amber: 'F59E0B',
  danger: 'EF4444',
  good: '22C55E',
  textDark: '1E293B',
  textLight: 'FFFFFF',
  muted: '64748B',
  border: 'CBD5E1',
  zebra: 'F1F5F9',
} as const

export type Tone = 'good' | 'warning' | 'danger' | 'neutral' | 'accent'

const TONE_FILL: Record<Tone, string> = {
  good: 'DCFCE7',
  warning: 'FEF3C7',
  danger: 'FEE2E2',
  neutral: 'F1F5F9',
  accent: 'E0FBF9',
}
const TONE_TEXT: Record<Tone, string> = {
  good: '166534',
  warning: '92400E',
  danger: '991B1B',
  neutral: '334155',
  accent: '0E7474',
}

function argb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`
}

function thinBorder(color = BRAND.border) {
  const style = { style: 'thin' as const, color: { argb: argb(color) } }
  return { top: style, left: style, bottom: style, right: style }
}

export interface KpiCard {
  label: string
  value: string | number
  sub?: string
  tone?: Tone
}

export interface TableColumn {
  header: string
  key: string
  width?: number
  numFmt?: string
  align?: 'left' | 'center' | 'right'
}

export interface TableRowStyle {
  /** Row index (0-based within the data rows) → tone override for the whole row */
  tone?: Tone
}

export interface TableOptions {
  headers: string[] | TableColumn[]
  rows: (string | number | null | undefined)[][] | Record<string, string | number | null | undefined>[]
  /** Optional per-row tone, aligned by index with `rows` — used to highlight
   * violations / failing / out-of-spec rows in a report. */
  rowTones?: (Tone | undefined)[]
  title?: string
  startRow?: number
  zebra?: boolean
}

// ── Sheet wrapper — tracks the current row cursor and exposes report-building
// helpers so each tool's export code reads like a list of sections rather
// than raw cell coordinates. ────────────────────────────────────────────
class ReportSheet {
  ws: ExcelJS.Worksheet
  private cursor = 1
  private maxCol = 1

  constructor(ws: ExcelJS.Worksheet) {
    this.ws = ws
    this.ws.views = [{ showGridLines: false }]
  }

  private bumpCol(n: number) {
    if (n > this.maxCol) this.maxCol = n
  }

  /** Branded title band — tool name + subtitle, dark background, spans full width. */
  titleBand(toolName: string, subtitle?: string, cols = 6) {
    this.bumpCol(cols)
    const row = this.ws.getRow(this.cursor)
    this.ws.mergeCells(this.cursor, 1, this.cursor, cols)
    const cell = row.getCell(1)
    cell.value = `Quality Hub — ${toolName}`
    cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: argb(BRAND.textLight) } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    row.height = 30
    this.cursor++

    if (subtitle) {
      this.ws.mergeCells(this.cursor, 1, this.cursor, cols)
      const sub = this.ws.getRow(this.cursor).getCell(1)
      sub.value = subtitle
      sub.font = { name: 'Calibri', size: 10.5, color: { argb: argb(BRAND.accent) } }
      sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } }
      sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      this.ws.getRow(this.cursor).height = 18
      this.cursor++
    }
    this.cursor++ // blank spacer row
    return this
  }

  /** Small metadata strip: Generated on / Standard / etc. Pairs of [label, value]. */
  metaStrip(pairs: [string, string | number][], cols = 6) {
    this.bumpCol(cols)
    for (const [label, rawValue] of pairs) {
      const value = String(rawValue)
      const row = this.ws.getRow(this.cursor)
      const labelCell = row.getCell(1)
      labelCell.value = label
      labelCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: argb(BRAND.muted) } }
      this.ws.mergeCells(this.cursor, 2, this.cursor, cols)
      const valueCell = row.getCell(2)
      valueCell.value = value
      valueCell.font = { name: 'Calibri', size: 9.5, color: { argb: argb(BRAND.textDark) } }
      this.cursor++
    }
    this.cursor++ // spacer
    return this
  }

  /** Section heading — a colored left-accent bar + bold label. */
  sectionHeading(text: string, cols = 6) {
    this.bumpCol(cols)
    this.ws.mergeCells(this.cursor, 1, this.cursor, cols)
    const cell = this.ws.getRow(this.cursor).getCell(1)
    cell.value = text
    cell.font = { name: 'Calibri', size: 12.5, bold: true, color: { argb: argb(BRAND.textDark) } }
    cell.border = { bottom: { style: 'medium', color: { argb: argb(BRAND.accent) } } }
    cell.alignment = { vertical: 'middle' }
    this.ws.getRow(this.cursor).height = 22
    this.cursor += 2 // one blank row after
    return this
  }

  /** Row of KPI cards (like a dashboard) — each spans equal columns. */
  kpiRow(cards: KpiCard[]) {
    const span = 2
    const totalCols = cards.length * span
    this.bumpCol(totalCols)
    const valueRowIdx = this.cursor
    const labelRowIdx = this.cursor + 1
    const subRowIdx = this.cursor + 2

    cards.forEach((card, i) => {
      const startCol = i * span + 1
      const endCol = startCol + span - 1
      const tone = card.tone ?? 'accent'

      this.ws.mergeCells(valueRowIdx, startCol, valueRowIdx, endCol)
      const vCell = this.ws.getRow(valueRowIdx).getCell(startCol)
      vCell.value = card.value
      vCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: argb(TONE_TEXT[tone]) } }
      vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(TONE_FILL[tone]) } }
      vCell.alignment = { horizontal: 'center', vertical: 'middle' }
      vCell.border = thinBorder()

      this.ws.mergeCells(labelRowIdx, startCol, labelRowIdx, endCol)
      const lCell = this.ws.getRow(labelRowIdx).getCell(startCol)
      lCell.value = card.label
      lCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: argb(BRAND.textDark) } }
      lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(TONE_FILL[tone]) } }
      lCell.alignment = { horizontal: 'center' }
      lCell.border = thinBorder()

      if (card.sub) {
        this.ws.mergeCells(subRowIdx, startCol, subRowIdx, endCol)
        const sCell = this.ws.getRow(subRowIdx).getCell(startCol)
        sCell.value = card.sub
        sCell.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: argb(BRAND.muted) } }
        sCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(TONE_FILL[tone]) } }
        sCell.alignment = { horizontal: 'center' }
        sCell.border = thinBorder()
      }
    })

    this.ws.getRow(valueRowIdx).height = 26
    this.cursor = (cards.some(c => c.sub) ? subRowIdx : labelRowIdx) + 1
    this.cursor++ // spacer
    return this
  }

  /** A bordered, zebra-striped data table with a colored header row. */
  table(opts: TableOptions) {
    const cols: TableColumn[] = opts.headers.map(h =>
      typeof h === 'string' ? { header: h, key: h } : h
    )
    this.bumpCol(cols.length)

    if (opts.title) {
      this.sectionHeading(opts.title, cols.length)
    }

    // header row
    const headerRowIdx = this.cursor
    const headerRow = this.ws.getRow(headerRowIdx)
    cols.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = col.header
      cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: argb(BRAND.textLight) } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } }
      cell.alignment = { horizontal: col.align ?? 'center', vertical: 'middle', wrapText: true }
      cell.border = thinBorder()
    })
    headerRow.height = 20
    this.cursor++

    // data rows — accept either array-of-arrays or array-of-objects
    const dataRows: (string | number | null | undefined)[][] = Array.isArray(opts.rows[0])
      ? (opts.rows as (string | number | null | undefined)[][])
      : (opts.rows as Record<string, string | number | null | undefined>[]).map(r =>
          cols.map(c => r[c.key])
        )

    dataRows.forEach((rowData, rIdx) => {
      const row = this.ws.getRow(this.cursor)
      const tone = opts.rowTones?.[rIdx]
      const zebraOn = opts.zebra !== false && rIdx % 2 === 1
      rowData.forEach((val, cIdx) => {
        const col = cols[cIdx]
        const cell = row.getCell(cIdx + 1)
        cell.value = val === undefined || val === null ? '' : val
        if (col?.numFmt && typeof val === 'number') cell.numFmt = col.numFmt
        cell.font = { name: 'Calibri', size: 10, color: { argb: argb(tone ? TONE_TEXT[tone] : BRAND.textDark) } }
        cell.alignment = { horizontal: col?.align ?? (typeof val === 'number' ? 'right' : 'left'), vertical: 'middle' }
        cell.border = thinBorder()
        if (tone) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(TONE_FILL[tone]) } }
        } else if (zebraOn) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.zebra) } }
        }
      })
      this.cursor++
    })

    // column widths (only widen, never shrink an already-set width)
    cols.forEach((col, i) => {
      const colRef = this.ws.getColumn(i + 1)
      const desired = col.width ?? Math.max(col.header.length + 4, 12)
      colRef.width = Math.max(colRef.width ?? 0, desired)
    })

    this.cursor++ // spacer after table
    return this
  }

  /** A single free-text paragraph/note row (e.g. interpretation, conclusion). */
  note(text: string, tone: Tone = 'neutral', cols = 6) {
    this.bumpCol(cols)
    this.ws.mergeCells(this.cursor, 1, this.cursor, cols)
    const cell = this.ws.getRow(this.cursor).getCell(1)
    cell.value = text
    cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: argb(TONE_TEXT[tone]) } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(TONE_FILL[tone]) } }
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left', indent: 1 }
    cell.border = thinBorder()
    this.ws.getRow(this.cursor).height = 34
    this.cursor += 2
    return this
  }

  /** Blank spacer row(s). */
  spacer(n = 1) {
    this.cursor += n
    return this
  }

  /** Embed a chart image (PNG data URL from a Chart.js ref) at the current cursor. */
  async image(dataUrl: string, opts: { widthCm?: number; heightCm?: number } = {}) {
    const wb = this.ws.workbook
    const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl)
    if (!match) return this
    const ext = match[1] === 'jpeg' ? 'jpeg' : 'png'
    const imageId = wb.addImage({ base64: dataUrl, extension: ext })
    const widthPx = (opts.widthCm ?? 14) * 37.8
    const heightPx = (opts.heightCm ?? 8) * 37.8
    this.ws.addImage(imageId, {
      tl: { col: 0, row: this.cursor - 1 },
      ext: { width: widthPx, height: heightPx },
    })
    this.cursor += Math.ceil(heightPx / 20) + 1
    return this
  }

  freezeHeader(row = 3) {
    this.ws.views = [{ showGridLines: false, state: 'frozen', ySplit: row }]
    return this
  }
}

class Report {
  wb: ExcelJS.Workbook
  toolName: string

  constructor(toolName: string) {
    this.wb = new ExcelJS.Workbook()
    this.wb.creator = 'Quality Hub'
    this.wb.created = new Date()
    this.toolName = toolName
  }

  addSheet(name: string): ReportSheet {
    // Excel sheet names: max 31 chars, no []:*?/\\
    const safe = name.replace(/[[\]:*?/\\]/g, '').slice(0, 31)
    const ws = this.wb.addWorksheet(safe)
    return new ReportSheet(ws)
  }

  async download(filename: string) {
    const buf = await this.wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}

export interface CreateReportOptions {
  toolName: string
}

export function createReport(opts: CreateReportOptions): Report {
  return new Report(opts.toolName)
}

/** Standard "Generated on" timestamp string in a locale-neutral format. */
export function nowStamp(): string {
  const d = new Date()
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
