// ─────────────────────────────────────────────────────────────────────────
// Minimal dense-matrix helpers, scoped to what Multiple Linear Regression
// needs: build the design matrix, solve normal equations via Gauss-Jordan
// elimination with partial pivoting, and support VIF (variance inflation
// factor) diagnostics. No external linear-algebra dependency — the models
// this tool targets (a handful of predictors, tens to low-hundreds of rows)
// don't need anything more sophisticated, and pivoting keeps it numerically
// stable for the AQL/Gage-RR-sized datasets typical of this app.
// ─────────────────────────────────────────────────────────────────────────

export type Matrix = number[][]

export function transpose(a: Matrix): Matrix {
  const rows = a.length
  const cols = a[0]?.length ?? 0
  const out: Matrix = Array.from({ length: cols }, () => new Array(rows).fill(0))
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[j][i] = a[i][j]
    }
  }
  return out
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  const aRows = a.length
  const aCols = a[0]?.length ?? 0
  const bCols = b[0]?.length ?? 0
  const out: Matrix = Array.from({ length: aRows }, () => new Array(bCols).fill(0))
  for (let i = 0; i < aRows; i++) {
    for (let k = 0; k < aCols; k++) {
      const aik = a[i][k]
      if (aik === 0) continue
      for (let j = 0; j < bCols; j++) {
        out[i][j] += aik * b[k][j]
      }
    }
  }
  return out
}

export function multiplyVec(a: Matrix, v: number[]): number[] {
  return a.map((row) => row.reduce((s, val, j) => s + val * v[j], 0))
}

/** Gauss-Jordan matrix inversion with partial pivoting. Throws on a
 * singular (non-invertible) matrix — callers should catch this and surface
 * a friendly "predictors are collinear" message rather than crashing. */
export function invert(a: Matrix): Matrix {
  const n = a.length
  // Augment [A | I]
  const aug: number[][] = a.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ])

  for (let col = 0; col < n; col++) {
    // Partial pivot: find the row with the largest absolute value in this column
    let pivotRow = col
    let maxVal = Math.abs(aug[col][col])
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > maxVal) {
        maxVal = Math.abs(aug[r][col])
        pivotRow = r
      }
    }
    if (maxVal < 1e-10) {
      throw new Error('singular-matrix')
    }
    if (pivotRow !== col) {
      const tmp = aug[col]
      aug[col] = aug[pivotRow]
      aug[pivotRow] = tmp
    }

    const pivot = aug[col][col]
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot

    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = aug[r][col]
      if (factor === 0) continue
      for (let j = 0; j < 2 * n; j++) {
        aug[r][j] -= factor * aug[col][j]
      }
    }
  }

  return aug.map((row) => row.slice(n))
}
