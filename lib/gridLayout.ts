// ─────────────────────────────────────────────────────────────────────────
// Reads the shape of a pasted or uploaded table before a tool uses it.
//
// People copy SPC data straight out of Excel, so the block often carries:
//   - a header row        ("Sample", "X1", "X2", …)
//   - a sample-number column (1, 2, 3, … down the first column)
//   - rows of unequal length (a subgroup with a missing reading)
//
// readGridLayout() works out which is which so a tool never counts a sample
// number as a reading and never drops readings without saying so. It only
// looks at the data; what to do with the answer is up to each tool.
// Nothing here changes any calculation.
// ─────────────────────────────────────────────────────────────────────────

/** A cell is a number only when the whole cell is one ("12.5", "-3", "1e-3"). */
export function isNumberCell(v: string): boolean {
  const s = v.trim()
  return s !== '' && Number.isFinite(Number(s))
}

// Header words that name a label column rather than readings (EN / AR, as
// typed in Excel). Dates and times come out of an .xlsx file as plain
// numbers (day counts), so a Date / Time header counts as a label too.
const ID_HEADER = /^(#|no\.?|n°|id|sample|sample\s*(no\.?|#|number)|subgroup|sub-?group\s*(no\.?|#)?|group|batch|lot|rank|index|date|time|date\s*\/?\s*time|shift|العينة|عينة|رقم|رقم العينة|المجموعة|مجموعة|م|التاريخ|تاريخ|الوقت|الوردية)$/i

export interface GridLayout {
  /** Numeric readings per data row, sample-number column already removed if found */
  rows: string[][]
  /** Readings in each row (rows[i].length) */
  widths: number[]
  /** A first column of sample numbers was found (and left out of rows) */
  idColumn: boolean
  /** The same rows with the first column kept, for "use it as data" */
  rowsWithFirstColumn: string[][]
  /** Rows dropped because they held no numbers at all (headers, notes) */
  skippedRows: number
}

/**
 * The first column is a sample-number column when, across every data row:
 *   - each row has at least two numbers (so there is something besides it), and
 *   - it holds whole numbers that count up by exactly 1 (1, 2, 3 … or 101, 102 …),
 *     over at least 3 rows;
 * or when its header cell names a label ("Sample", "No.", "Date", "رقم العينة" …).
 */
function looksLikeIdColumn(dataRows: string[][], header: string[] | null): boolean {
  if (dataRows.length < 3) return false
  if (!dataRows.every(r => isNumberCell(r[0] ?? '') && r.filter(isNumberCell).length >= 2)) return false
  if (header !== null && ID_HEADER.test((header[0] ?? '').trim())) return true
  const first = dataRows.map(r => Number(r[0]))
  return first.every((v, i) => Number.isInteger(v) && (i === 0 || v === first[i - 1] + 1))
}

export function readGridLayout(grid: string[][]): GridLayout {
  const cleaned = grid.map(r => r.map(c => (c ?? '').trim()))
  // Data rows: any row with at least one number. The last text-only row
  // before the first data row is taken as the header.
  let header: string[] | null = null
  const dataRows: string[][] = []
  let skippedRows = 0
  for (const r of cleaned) {
    if (r.some(isNumberCell)) dataRows.push(r)
    else {
      if (r.some(c => c !== '')) skippedRows++
      if (dataRows.length === 0) header = r
    }
  }

  const idColumn = looksLikeIdColumn(dataRows, header)
  const rowsWithFirstColumn = dataRows.map(r => r.filter(isNumberCell))
  const rows = idColumn ? dataRows.map(r => r.slice(1).filter(isNumberCell)) : rowsWithFirstColumn
  return { rows, widths: rows.map(r => r.length), idColumn, rowsWithFirstColumn, skippedRows }
}

/** The rows to use: without the sample-number column, unless the visitor chose to keep it. */
export function layoutRows(layout: GridLayout, keepFirstColumn: boolean): string[][] {
  return keepFirstColumn ? layout.rowsWithFirstColumn : layout.rows
}

/** 1-based positions of rows whose width differs from the most common width. */
export function unevenRows(rows: string[][]): { size: number; rows: number[] } {
  const count = new Map<number, number>()
  for (const r of rows) count.set(r.length, (count.get(r.length) ?? 0) + 1)
  let size = 0
  let best = -1
  for (const [w, n] of count) if (n > best || (n === best && w > size)) { size = w; best = n }
  return { size, rows: rows.flatMap((r, i) => (r.length !== size ? [i + 1] : [])) }
}
