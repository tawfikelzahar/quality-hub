// p-value display helpers (text only, no statistics).

/** p-value text as statistical software prints it: "< 0.005" below 0.005, otherwise 3 decimals. */
export function formatPValue(p: number | null | undefined): string {
  if (p === null || p === undefined || !isFinite(p)) return '—'
  if (p < 0.005) return '< 0.005'
  return p.toFixed(3)
}

/** "p = 0.968" / "p < 0.005" — for sentences and labels. */
export function formatPEquals(p: number | null | undefined): string {
  const t = formatPValue(p)
  return t.startsWith('<') ? `p ${t}` : `p = ${t}`
}

/**
 * Fixed decimals with half-up rounding of the intended value: 3.125 → "3.13".
 * Plain toFixed works on the stored binary value, so a result like
 * 15 / 480 × 100 (stored as 3.12499999…) would print as "3.12".
 */
export function fixed(v: number, digits: number): string {
  if (!isFinite(v)) return String(v)
  return Number(v.toPrecision(12)).toFixed(digits)
}
