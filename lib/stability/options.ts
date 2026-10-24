// What the Stability page may import in the browser (labels only).
// The analysis runs on the server: lib/stability/calc.ts, /api/stability.

// ── Common ICH storage conditions (informational label only) ──────────────
export const STORAGE_CONDITIONS = [
  { key: 'long-term', label: 'Long-term — 25°C / 60% RH' },
  { key: 'intermediate', label: 'Intermediate — 30°C / 65% RH' },
  { key: 'accelerated', label: 'Accelerated — 40°C / 75% RH' },
  { key: 'custom', label: 'Custom' },
] as const;
