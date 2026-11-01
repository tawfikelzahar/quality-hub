import 'server-only'
import type { RegressionFit } from '@/lib/regression/model'

// ─────────────────────────────────────────────────────────────────────────
// What a visitor or free account receives from /api/regression (free/Pro
// split, 1 Nov 2026). Free: the equation, coefficients with their p-values,
// S, R², R²(adj), the overall F test, the data with the fitted line, the
// point prediction, and every accuracy warning as a plain line. Pro: R²(pred),
// residual plots, standardized residuals / leverage / Cook, the unusual-
// observation table, VIF values, ANOVA by term, Durbin-Watson, confidence and
// prediction intervals. Nothing is recalculated here; Pro fields are removed.
// ─────────────────────────────────────────────────────────────────────────

/** Accuracy warnings for free accounts — always sent (rule: warnings are never locked) */
export interface RegressionFreeChecks {
  /** null when there are too few rows for the normality test */
  nonNormal: boolean | null
  unusualCount: number
  /** predictors with VIF > 10 */
  highVif: string[]
  /** predictors with 5 < VIF ≤ 10 */
  midVif: string[]
}

export type RegressionView = RegressionFit & { locked?: true; checks?: RegressionFreeChecks }

export function freeRegressionView(r: RegressionFit): RegressionView {
  const checks: RegressionFreeChecks = {
    nonNormal: r.normality ? r.normality.p < 0.05 : null,
    unusualCount: r.unusual.length,
    highVif: r.coefficients.filter(c => c.vif !== null && c.vif > 10).map(c => c.term),
    midVif: r.coefficients.filter(c => c.vif !== null && c.vif > 5 && c.vif <= 10).map(c => c.term),
  }
  return {
    ...r,
    coefficients: r.coefficients.map(c => ({ ...c, vif: null })),
    anova: [],
    r2Pred: null,
    residuals: r.residuals.map(e => ({ row: e.row, y: e.y, x: e.x, fit: e.fit, resid: e.y - e.fit, stdResid: 0, leverage: 0, cook: 0, flags: [] })),
    unusual: [],
    leverageLimit: 0,
    normality: null,
    normalPlot: [],
    durbinWatson: 0,
    band: null,
    prediction: r.prediction
      ? { x: r.prediction.x, fit: r.prediction.fit, beyondData: r.prediction.beyondData, seFit: 0, ciLo: 0, ciHi: 0, piLo: 0, piHi: 0 }
      : null,
    locked: true,
    checks,
  }
}
