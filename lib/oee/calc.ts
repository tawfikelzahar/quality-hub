import type { TKey } from '@/lib/i18n/translations'

// ─────────────────────────────────────────────────────────────────────────
// OEE = Availability × Performance × Quality  (Nakajima / JIPM TPM standard)
//   A = Run time ÷ (Planned time − Breaks)
//   P = Ideal cycle time × Total count ÷ Run time
//   Q = Good count (first pass) ÷ Total count
// Checked against the worked example on oee.com (tests/golden/oee/check.mts).
// Public formulas, so this stays in the browser (roadmap P6 rule).
// ─────────────────────────────────────────────────────────────────────────

export interface OEEInputs {
  plannedTime: number   // minutes
  breaks: number         // minutes (planned downtime, excluded from base)
  downtime: number       // minutes (unplanned)
  cycleTime: number      // seconds / part (ideal cycle time)
  totalCount: number     // parts produced
  goodCount: number      // good parts (first pass)
}

export interface OEEResult {
  netPlanned: number
  runTime: number
  availability: number
  performance: number
  performanceCapped: number
  quality: number
  oee: number
  downtimeLoss: number
  speedLoss: number
  qualityLoss: number
}

export type Classification = 'world-class' | 'good' | 'average' | 'poor'

export function classify(oee: number): { labelKey: TKey; type: Classification } {
  if (oee >= 85) return { labelKey: 'oee_class_worldclass', type: 'world-class' }
  if (oee >= 60) return { labelKey: 'oee_class_good', type: 'good' }
  if (oee >= 40) return { labelKey: 'oee_class_average', type: 'average' }
  return { labelKey: 'oee_class_poor', type: 'poor' }
}

export function calcOEE(i: OEEInputs): OEEResult | null {
  const netPlanned = i.plannedTime - i.breaks
  if (netPlanned <= 0) return null
  if (i.downtime >= netPlanned) return null

  const runTime = netPlanned - i.downtime
  const availability = (runTime / netPlanned) * 100
  const performance = i.totalCount > 0 && i.cycleTime > 0
    ? ((i.totalCount * i.cycleTime) / 60 / runTime) * 100
    : 0
  const performanceCapped = Math.min(performance, 100)
  const quality = i.totalCount > 0 ? (i.goodCount / i.totalCount) * 100 : 0
  const oee = (availability / 100) * (performanceCapped / 100) * (quality / 100) * 100

  const downtimeLoss = (i.downtime / netPlanned) * 100
  const speedLoss = Math.max(0, 100 - performance) * (runTime / netPlanned)
  const qualityLoss = Math.max(0, 100 - quality) * (runTime / netPlanned) * (performanceCapped / 100)

  return {
    netPlanned, runTime, availability, performance, performanceCapped,
    quality, oee, downtimeLoss, speedLoss, qualityLoss,
  }
}

export function validate(i: OEEInputs): TKey | null {
  if (i.plannedTime <= 0) return 'oee_err_planned'
  if (i.plannedTime - i.breaks <= 0) return 'oee_err_breaks'
  if (i.downtime >= i.plannedTime - i.breaks) return 'oee_err_downtime'
  if (i.goodCount > i.totalCount) return 'oee_err_goodparts'
  if (i.cycleTime <= 0) return 'oee_err_cycletime'
  // Performance above 100% is physically impossible: the ideal cycle time is
  // too long, or the counts include parts made outside the run time. Stop
  // instead of quietly capping it, which would give a plausible-looking OEE.
  const runTime = i.plannedTime - i.breaks - i.downtime
  if (i.totalCount > 0 && (i.totalCount * i.cycleTime) / 60 > runTime * 1.000001) return 'oee_err_perf_over'
  return null
}


// ── Losses in minutes and parts (roadmap O6) ────────────────────────────
// The same three losses as downtimeLoss / speedLoss / qualityLoss, expressed
// in time and parts instead of % of net planned time:
//   downtime  = unplanned stops
//   speed     = run time − ideal time for the parts made
//   quality   = ideal time spent on rejected parts
//   productive (fully productive time) = good count × ideal cycle time
// downtime + speed + quality + productive = net planned time (oee.com).
export interface OEELossTime {
  downtimeMin: number
  speedMin: number
  qualityMin: number
  productiveMin: number
  /** parts the line could have made in the speed-loss minutes */
  speedParts: number
  /** rejected parts */
  qualityParts: number
}

export function lossTime(i: OEEInputs, r: OEEResult): OEELossTime {
  const idealMin = (parts: number) => (parts * i.cycleTime) / 60
  const speedMin = Math.max(0, r.runTime - idealMin(i.totalCount))
  return {
    downtimeMin: i.downtime,
    speedMin,
    qualityMin: idealMin(i.totalCount - i.goodCount),
    productiveMin: idealMin(i.goodCount),
    speedParts: (speedMin * 60) / i.cycleTime,
    qualityParts: i.totalCount - i.goodCount,
  }
}
