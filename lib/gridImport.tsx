// ─────────────────────────────────────────────────────────────────────────
// Quality Hub — shared paste / Excel import module
// ─────────────────────────────────────────────────────────────────────────
// Every data-entry tool (Pareto, DPMO, SPC, Descriptive, X̄-R, X̄-S, I-MR,
// Regression, Multiple Regression) needs the same two things:
//
//   1. A global Ctrl+V handler — pasting anywhere on the page (outside a
//      text input/textarea) fills the tool's table straight away.
//   2. A file-upload button that accepts .csv AND .xlsx/.xls — not CSV only.
//
// This file gives every tool ONE shared implementation of both, instead of
// each page carrying its own near-duplicate parseDelimited/parseExcelFile
// pair (which is how Pareto and DPMO ended up drifting from everyone else).
//
// A tool using this module still owns its own "shape" a row is turned into
// (VarRow, ProcessRow, DataRow, …) — this module only gets you as far as a
// clean string[][] grid. Each page's own mapping function takes it from
// there, exactly like today's parseVariablePaste/parseAttributePaste etc.
// do — they just stop needing their own text-splitting and XLSX-reading code.
//
// Usage pattern:
//
//   const { pasteToast, fileError, sheetPicker, openFilePicker, fileInputRef }
//     = useGridImport({
//         onGrid: (grid) => setRows(myRowsFromGrid(grid)),
//       })
//
//   <input ref={fileInputRef} type="file" accept={GRID_IMPORT_ACCEPT}
//          onChange={handleFilePicked} style={{ display: 'none' }} />
//   <button onClick={openFilePicker}>Upload file</button>
//   {sheetPicker}   {/* renders nothing unless the workbook has >1 sheet */}
//
// ─────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import * as XLSX from 'xlsx'

export const GRID_IMPORT_ACCEPT = '.csv,.xlsx,.xls'

// ── Delimited text (typed CSV, or a Ctrl+V paste from Excel/Sheets) ────────
// Excel/Sheets copy onto the clipboard as tab-separated; a .csv file on disk
// is comma-separated. Detect per line so a paste and a CSV both parse right.
export function parseDelimitedText(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '')
  return lines.map(line => {
    const delimiter = line.includes('\t') ? '\t' : ','
    return line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''))
  })
}

// ── Excel workbook → one sheet's cells as a string grid ────────────────────
function sheetToGrid(sheet: XLSX.WorkSheet): string[][] {
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
  return json
    .filter(row => Array.isArray(row))
    .map(row => row.map(cell => (cell === null || cell === undefined ? '' : String(cell).trim())))
}

function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = e.target?.result
        resolve(XLSX.read(data, { type: 'binary' }))
      } catch {
        reject(new Error('workbook'))
      }
    }
    reader.onerror = () => reject(new Error('read'))
    reader.readAsBinaryString(file)
  })
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve((e.target?.result as string) ?? '')
    reader.onerror = () => reject(new Error('read'))
    reader.readAsText(file)
  })
}

// A row counts as a plausible header (rather than data) if none of its
// cells parse as a number — e.g. "Category,Count" or "Part,Op1,Op2".
// This lets every tool skip an Excel header row automatically instead of
// asking the user to remove it before uploading.
function looksLikeHeaderRow(row: string[]): boolean {
  if (row.length === 0) return false
  return row.every(cell => cell.trim() === '' || isNaN(parseFloat(cell)))
}

// Drops a leading header row (if any) and any fully-blank rows. Applied to
// both pasted text and uploaded files so the two behave identically.
export function stripHeaderAndBlankRows(grid: string[][]): string[][] {
  const rows = grid.filter(row => row.some(cell => cell.trim() !== ''))
  if (rows.length > 1 && looksLikeHeaderRow(rows[0])) {
    return rows.slice(1)
  }
  return rows
}

export interface GridImportOptions {
  // Called with a cleaned grid (header row and blank rows already removed)
  // any time text is pasted or a file finishes parsing successfully.
  onGrid: (grid: string[][]) => void
  // Optional: minimum non-empty cells a parsed row must have to count as
  // data, used only to decide whether a paste/file produced *anything*
  // (for the error message) — the page's own mapping function still does
  // its own real validation. Defaults to 1.
  minCellsPerRow?: number
  // Optional: called whenever an import (paste or file) is rejected.
  onError?: (message: string) => void
  // Set to false for a page (like SPC) that already owns a global Ctrl+V
  // listener with its own mode-aware parsing — it can use this hook for
  // file upload only and keep its existing paste behavior untouched.
  enablePasteListener?: boolean
  // Set to true for a page (like Regression) that needs the first row as
  // column headers rather than data — e.g. picking which column is X and
  // which is Y. Header-row auto-detection is skipped entirely so the first
  // row always survives, whatever it looks like; only fully-blank rows
  // are still dropped.
  keepHeaderRow?: boolean
}

export interface GridImportState {
  pasteToast: boolean
  fileError: string
  // Renders the hidden <input type="file">. The ref it needs lives inside
  // the hook and is never handed back to the caller — passing a ref object
  // out of a hook and reading it during render trips the refs-during-render
  // lint rule, so callers render this instead of wiring up the input (and
  // the accept attribute) themselves.
  FileInput: () => React.ReactElement
  openFilePicker: () => void
  handleFilePicked: (e: ChangeEvent<HTMLInputElement>) => void
  // >1 sheet found in the last uploaded workbook — until the user picks one,
  // the first sheet is used, exactly like today's Pareto/DPMO behavior, so
  // upload never blocks on a choice the user didn't ask to make.
  sheetNames: string[]
  activeSheet: string
  selectSheet: (name: string) => void
}

export function useGridImport({
  onGrid,
  minCellsPerRow = 1,
  onError,
  enablePasteListener = true,
  keepHeaderRow = false,
}: GridImportOptions): GridImportState {
  const [pasteToast, setPasteToast] = useState(false)
  const [fileError, setFileError] = useState('')
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState('')
  const workbookRef = useRef<XLSX.WorkBook | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const emitError = useCallback(
    (message: string) => {
      setFileError(message)
      onError?.(message)
    },
    [onError]
  )

  const commitGrid = useCallback(
    (rawGrid: string[][], onEmpty: string) => {
      const withoutBlanks = rawGrid.filter(row => row.some(cell => cell.trim() !== ''))
      const cleaned = (keepHeaderRow ? withoutBlanks : stripHeaderAndBlankRows(withoutBlanks)).filter(
        row => row.filter(c => c !== '').length >= minCellsPerRow
      )
      if (cleaned.length === 0) {
        emitError(onEmpty)
        return
      }
      setFileError('')
      onGrid(cleaned)
    },
    [emitError, keepHeaderRow, minCellsPerRow, onGrid]
  )

  // ── Global Ctrl+V — matches the existing Pareto/DPMO/SPC behavior ───────
  useEffect(() => {
    if (!enablePasteListener) return
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const text = e.clipboardData?.getData('text')
      if (!text) return
      const grid = parseDelimitedText(text)
      const withoutBlanks = grid.filter(row => row.some(cell => cell.trim() !== ''))
      const cleaned = (keepHeaderRow ? withoutBlanks : stripHeaderAndBlankRows(withoutBlanks)).filter(
        row => row.filter(c => c !== '').length >= minCellsPerRow
      )
      if (cleaned.length === 0) return // not a data paste — leave it alone
      e.preventDefault()
      setFileError('')
      onGrid(cleaned)
      setPasteToast(true)
      setTimeout(() => setPasteToast(false), 2000)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [onGrid, minCellsPerRow, enablePasteListener, keepHeaderRow])

  const loadSheet = useCallback(
    (workbook: XLSX.WorkBook, sheetName: string) => {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) return
      commitGrid(sheetToGrid(sheet), 'No usable data found on that sheet.')
    },
    [commitGrid]
  )

  const selectSheet = useCallback(
    (name: string) => {
      setActiveSheet(name)
      if (workbookRef.current) loadSheet(workbookRef.current, name)
    },
    [loadSheet]
  )

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), [])

  const handleFilePicked = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = '' // allow re-uploading the same file name later
      if (!file) return

      const isCSV = file.name.toLowerCase().endsWith('.csv')
      const isExcel = /\.(xlsx|xls)$/i.test(file.name)

      if (!isCSV && !isExcel) {
        emitError('Please upload a .csv, .xlsx, or .xls file.')
        return
      }

      if (isCSV) {
        setSheetNames([])
        setActiveSheet('')
        workbookRef.current = null
        readTextFile(file)
          .then(text => commitGrid(parseDelimitedText(text), 'No usable data found in that file.'))
          .catch(() => emitError('Could not read that file.'))
        return
      }

      readWorkbook(file)
        .then(workbook => {
          workbookRef.current = workbook
          const names = workbook.SheetNames
          setSheetNames(names)
          const first = names[0]
          setActiveSheet(first)
          loadSheet(workbook, first)
        })
        .catch(() => emitError('Could not read that Excel file.'))
    },
    [commitGrid, emitError, loadSheet]
  )

  // The ref stays entirely inside this closure — FileInput is the only
  // thing that touches it, and its identity is stable across re-renders
  // (handleFilePicked is memoized above), so callers can render it freely.
  const FileInput = useMemo(() => {
    const Component = () => (
      <input
        ref={fileInputRef}
        type="file"
        accept={GRID_IMPORT_ACCEPT}
        onChange={handleFilePicked}
        style={{ display: 'none' }}
      />
    )
    Component.displayName = 'GridImportFileInput'
    return Component
  }, [handleFilePicked])

  return {
    pasteToast,
    fileError,
    FileInput,
    openFilePicker,
    handleFilePicked,
    sheetNames,
    activeSheet,
    selectSheet,
  }
}
