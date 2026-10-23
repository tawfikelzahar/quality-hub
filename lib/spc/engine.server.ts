import 'server-only'

// ─────────────────────────────────────────────────────────────────────────
// Server-side entry to the variable-chart calculator (I-MR, X̄-R, X̄-S).
//
// The calculator itself (./calculator.ts) is unchanged and still covered by
// the golden tests. This file only exists so that page code cannot pull the
// calculator into the browser bundle: 'server-only' makes the build fail if
// anything on the client imports this module, and the ESLint rule in
// eslint.config.mjs forbids importing ./calculator directly from pages and
// components (type-only imports are allowed).
// ─────────────────────────────────────────────────────────────────────────

export { runVariableChartAnalysis, runXbarSAnalysis } from './calculator'
