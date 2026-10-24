// What the Stability page may import in the browser (labels only).
// The analysis runs on the server: lib/stability/calc.ts, /api/stability.

/**
 * How the storage condition is treated by ICH Q1E 2.4 when the shelf life
 * goes beyond the data: room temperature, refrigerator, freezer, or a
 * supporting condition (intermediate, accelerated) that does not set the
 * shelf life on its own.
 */
export type StorageKind = 'room' | 'refrigerated' | 'frozen' | 'support' | 'other';

// ── ICH storage conditions (label for the reports, kind for the claim rule) ──
export const STORAGE_CONDITIONS = [
  { key: 'long-term', label: 'Long-term — 25°C / 60% RH', kind: 'room' },
  { key: 'long-term-30', label: 'Long-term — 30°C / 65% or 75% RH', kind: 'room' },
  { key: 'refrigerated', label: 'Long-term — 5°C ± 3°C (refrigerator)', kind: 'refrigerated' },
  { key: 'frozen', label: 'Long-term — −20°C ± 5°C (freezer)', kind: 'frozen' },
  { key: 'intermediate', label: 'Intermediate — 30°C / 65% RH', kind: 'support' },
  { key: 'accelerated', label: 'Accelerated — 40°C / 75% RH', kind: 'support' },
  { key: 'custom', label: 'Custom', kind: 'other' },
] as const satisfies readonly { key: string; label: string; kind: StorageKind }[];

export type StorageKey = (typeof STORAGE_CONDITIONS)[number]['key'];

export const storageKindOf = (key: string): StorageKind =>
  STORAGE_CONDITIONS.find((s) => s.key === key)?.kind ?? 'other';
