// ─────────────────────────────────────────────────────────────────────────
// SPC report interpretation — the rule-based "engineering interpretation"
// printed in the SPC Engine PDF report (Capability Diagnosis, Recommended
// Action, Study Conclusion).
//
// Pure functions with no React / jsPDF imports so every branch can be
// tested with plain numbers. Same input always gives the same text — this
// is deliberately NOT the future AI Insights feature, which will explain
// these results in natural language on top of this layer, never replace it.
//
// Cases covered:
//   • two-sided specs, normal data      → Cp / Cpk (within sigma)
//   • two-sided specs, non-normal data  → Pp / Ppk (overall sigma)
//   • one-sided spec (LSL or USL only)  → Cpk or Ppk against that limit
//   • no spec limits / attribute charts → stability-only conclusion
// Every recommendation also accounts for process stability (Nelson rules),
// the sample-size tier and, when given, the target value.
// ─────────────────────────────────────────────────────────────────────────

export type Tone = 'good' | 'warn' | 'bad' | 'info'
export type AdequacyTier = 'low' | 'moderate' | 'adequate'

export interface RuleSignal {
  rule: number
  /** true when the signal came from the R / MR / S chart, not the location chart */
  dispersionChart: boolean
}

export interface CapabilityInput {
  LSL: number | null
  USL: number | null
  target: number | null
  /** process centre used for within indices (X̄ chart centre line) */
  center: number
  /** overall mean used for Pp/Ppk */
  mu: number
  sigmaWithin: number
  sdOverall: number
  /** true when Cp/Cpk were computed (normality not rejected) */
  normal: boolean
  signals: RuleSignal[]
  n: number
  adequacyTier: AdequacyTier
}

export interface DiagnosisRow {
  dimension: string
  result: string
  assessment: string
  tone: Tone
}

export interface CapabilityDiagnosis {
  basis: 'within' | 'overall'
  rows: DiagnosisRow[]
  recommendedAction: string
  tone: Tone
}

const CAPABLE = 1.33
// Gap between the two one-sided indices treated as "centered" — unchanged
// from the original report logic.
const CENTERING_TOLERANCE = 0.1

function f(n: number, d = 3): string {
  return isFinite(n) ? n.toFixed(d) : '—'
}

// ── Nelson rule meanings ────────────────────────────────────────────────
// Standard interpretations (Western Electric / Nelson, as used in
// Montgomery's SPC text). Location-chart meaning first; a signal on the
// R / MR / S chart always points at a change in short-term variation.
const RULE_MEANING: Record<number, string> = {
  1: 'Rule 1 (point beyond 3σ): a special cause affected specific points — check what changed at those points (material lot, setup, operator, measurement).',
  2: 'Rule 2 (9 points on one side): the process mean has shifted — look for a lasting change such as a new material lot, a setting change or a different gauge.',
  3: 'Rule 3 (6 points trending): gradual drift — typical causes are tool wear, temperature build-up or depletion of a consumable.',
  4: 'Rule 4 (14 points alternating): over-adjustment, or two alternating sources such as two machines, fixtures or operators.',
  5: 'Rule 5 (2 of 3 beyond 2σ): a likely large shift in the process mean.',
  6: 'Rule 6 (4 of 5 beyond 1σ): a likely small but sustained shift in the process mean.',
  7: 'Rule 7 (15 points within 1σ): stratification — variation is smaller than the limits expect; check subgroup formation (mixed streams in one subgroup) or how the limits were calculated.',
  8: 'Rule 8 (8 points beyond 1σ on both sides): a mixture of two sources — the data likely comes from two different machines, cavities, shifts or lots.',
}

export function describeSignals(signals: RuleSignal[]): string {
  const locationRules = [...new Set(signals.filter(s => !s.dispersionChart).map(s => s.rule))].sort((a, b) => a - b)
  const dispersionRules = [...new Set(signals.filter(s => s.dispersionChart).map(s => s.rule))].sort((a, b) => a - b)
  const parts = locationRules.map(r => RULE_MEANING[r]).filter(Boolean)
  if (dispersionRules.length > 0) {
    const list = dispersionRules.length === 1 ? `Rule ${dispersionRules[0]}` : `Rules ${dispersionRules.join(', ')}`
    parts.push(
      `${list} on the range/variation chart: short-term variation has changed — check for inconsistent setup, worn equipment or measurement problems.`
    )
  }
  return parts.join(' ')
}

export function sampleSizeNote(n: number, tier: AdequacyTier, unit: 'readings' | 'subgroups' = 'readings'): string {
  if (tier === 'low') {
    return `This study is based on only ${n} ${unit}, so treat this conclusion as preliminary and confirm it with at least 30 ${unit} before acting on it.`
  }
  if (tier === 'moderate') {
    return `With ${n} ${unit}, confidence is moderate — confirm with about 100 ${unit} before high-stakes decisions such as customer submissions.`
  }
  return ''
}

function joinSentences(...s: string[]): string {
  return s.filter(Boolean).join(' ')
}

function unstableAction(signals: RuleSignal[]): string {
  return joinSentences(
    'Do not rely on capability indices yet — the process is not in statistical control.',
    describeSignals(signals),
    'Remove the special causes, then repeat the study on stable data.'
  )
}

// ── Capability diagnosis (any spec limit present) ───────────────────────
export function buildCapabilityDiagnosis(input: CapabilityInput): CapabilityDiagnosis | null {
  const { LSL, USL, target, normal, signals, n, adequacyTier } = input
  if (LSL === null && USL === null) return null

  const basis: 'within' | 'overall' = normal ? 'within' : 'overall'
  const s = normal ? input.sigmaWithin : input.sdOverall
  const c = normal ? input.center : input.mu
  if (!(s > 0) || !isFinite(c)) return null

  const spreadName = normal ? 'Cp' : 'Pp'
  const idxName = normal ? 'Cpk' : 'Ppk'
  const stable = signals.length === 0
  const rows: DiagnosisRow[] = []

  const kLower = LSL !== null ? (c - LSL) / (3 * s) : null
  const kUpper = USL !== null ? (USL - c) / (3 * s) : null
  const sides = [kLower, kUpper].filter((k): k is number => k !== null)
  const minK = Math.min(...sides)
  const meanOutside = minK < 0

  let core: string
  let tone: Tone

  if (LSL !== null && USL !== null) {
    // ── two-sided ──
    const spread = (USL - LSL) / (6 * s)
    const spreadOk = spread >= CAPABLE
    const centeringOk = Math.abs((kUpper as number) - (kLower as number)) < CENTERING_TOLERANCE
    const nearer: 'LSL' | 'USL' = (kLower as number) <= (kUpper as number) ? 'LSL' : 'USL'
    const tolUsed = (6 * s) / (USL - LSL)

    rows.push({
      dimension: 'Process Spread',
      result: `${spreadName} = ${f(spread)}`,
      assessment: spreadOk
        ? `Spread is acceptable — the process uses ${f(tolUsed * 100, 0)}% of the tolerance.`
        : `Spread is too wide — the process uses ${f(tolUsed * 100, 0)}% of the tolerance; variation reduction is needed.`,
      tone: spreadOk ? 'good' : 'warn',
    })
    rows.push({
      dimension: 'Process Centering',
      result: centeringOk ? 'Centered' : `Closer to ${nearer}`,
      assessment: centeringOk
        ? 'Process is reasonably centered between the specification limits.'
        : `Mean is ${f(Math.abs(c - (LSL + USL) / 2))} from mid-specification, toward the ${nearer} — this is a main driver of the lower ${idxName}.`,
      tone: centeringOk ? 'good' : 'warn',
    })

    const centerTo = target !== null ? `toward the target (${f(target)})` : `away from the ${nearer}`
    if (meanOutside) {
      core = `The process mean (${f(c)}) is outside the specification — contain suspect product and correct the process setting immediately.`
      tone = 'bad'
    } else if (!spreadOk && !centeringOk) {
      core = `Both variation reduction and better centering are needed. Move the mean ${centerTo}; reducing variation alone will not be sufficient.`
      tone = 'warn'
    } else if (!spreadOk) {
      core = `Prioritize reducing process variation — the specification width limits achievable capability even with perfect centering (${spreadName} ${f(spread)} < ${CAPABLE}).`
      tone = 'warn'
    } else if (!centeringOk) {
      core = `Prioritize centering — move the mean ${centerTo}. Variation is already acceptable relative to the specification width.`
      tone = 'warn'
    } else {
      core = 'Process capability is acceptable. Continue routine monitoring and control.'
      tone = 'good'
    }
  } else {
    // ── one-sided ──
    const limitName = LSL !== null ? 'LSL' : 'USL'
    const k = sides[0]
    const ok = k >= CAPABLE
    rows.push({
      dimension: 'Process Spread',
      result: 'Not assessable',
      assessment: `${spreadName} needs both LSL and USL — only the ${limitName} was provided, so spread and centering cannot be separated.`,
      tone: 'info',
    })
    rows.push({
      dimension: `Distance to ${limitName}`,
      result: `${idxName} = ${f(k)}`,
      assessment: ok
        ? `The mean is far enough from the ${limitName} relative to the process variation.`
        : `The mean is too close to the ${limitName} for the current variation (${idxName} < ${CAPABLE}).`,
      tone: ok ? 'good' : k >= 1 ? 'warn' : 'bad',
    })
    if (meanOutside) {
      core = `The process mean (${f(c)}) is beyond the ${limitName} — contain suspect product and correct the process setting immediately.`
      tone = 'bad'
    } else if (!ok) {
      core = `Increase the margin to the ${limitName}: move the mean further from it, reduce variation, or both.`
      tone = 'warn'
    } else {
      core = 'Process capability against the single specification limit is acceptable. Continue routine monitoring and control.'
      tone = 'good'
    }
  }

  if (target !== null) {
    const off = c - target
    rows.push({
      dimension: 'Offset from Target',
      result: `${off >= 0 ? '+' : ''}${f(off)}`,
      assessment:
        Math.abs(off) < 1e-12
          ? 'Mean is on target.'
          : `Mean is ${f(Math.abs(off))} ${off > 0 ? 'above' : 'below'} the target (${f(Math.abs(off) / s, 2)} σ).`,
      tone: 'info',
    })
  }

  let action: string
  if (!stable) {
    action = unstableAction(signals)
    tone = 'bad'
  } else {
    action = core
  }

  const normalityNote = normal
    ? ''
    : `Normality was rejected, so this diagnosis uses overall variation (${spreadName}/${idxName}); confirm with a distribution fit or transformation before final decisions.`

  const recommendedAction = joinSentences(action, stable ? normalityNote : '', sampleSizeNote(n, adequacyTier))
  if (stable && tone === 'good' && adequacyTier === 'low') tone = 'warn'

  return { basis, rows, recommendedAction, tone }
}

// ── Study conclusion ────────────────────────────────────────────────────
export interface ConclusionInput {
  /** classification label, e.g. "CAPABLE PROCESS"; null when no spec limits */
  classLabel: string | null
  /** 'Cpk' | 'Ppk' — the index the classification is based on */
  indexName: 'Cpk' | 'Ppk' | null
  indexValue: number | null
  ppk: number | null
  ppmOverall: number | null
  yieldText: string | null
  normal: boolean
  signals: RuleSignal[]
  n: number
  adequacyTier: AdequacyTier
  /** attribute charts: e.g. "p-chart" and its centre line, "p̄ = 0.0300" */
  attribute?: { chartLabel: string; metricText: string } | null
}

export interface StudyConclusion {
  text: string
  tone: Tone
}

export function buildStudyConclusion(input: ConclusionInput): StudyConclusion {
  const { classLabel, indexName, indexValue, signals, n, adequacyTier } = input
  const stable = signals.length === 0
  const sizeNote = sampleSizeNote(n, adequacyTier, input.attribute ? 'subgroups' : 'readings')

  // ── stability-only: attribute charts or no spec limits ──
  if (classLabel === null || indexName === null || indexValue === null) {
    const subject = input.attribute
      ? `The ${input.attribute.chartLabel} (${input.attribute.metricText})`
      : 'The process'
    const stability = stable
      ? `${subject} shows no special-cause signals over the study period and appears to be in statistical control.`
      : `${subject} shows ${signals.length} special-cause signal(s) and is not in statistical control. ${describeSignals(signals)}`
    const capNote = input.attribute
      ? ''
      : 'Capability cannot be assessed because no specification limits were provided — add the LSL and/or USL to evaluate Cp/Cpk.'
    return {
      text: joinSentences(stability, capNote, sizeNote),
      tone: !stable ? 'warn' : adequacyTier === 'low' ? 'warn' : 'good',
    }
  }

  // ── capability classification ──
  const basis =
    indexName === 'Cpk'
      ? `The process is classified as ${classLabel} based on Cpk, the primary capability index for this analysis, since the normality assumption was not rejected. Cpk is ${f(indexValue)}${input.ppk !== null ? ` and Ppk is ${f(input.ppk)}` : ''}.`
      : `The process is classified as ${classLabel} based on Ppk, the primary performance indicator for this analysis. ${input.normal ? '' : 'Because the normality assumption was rejected, Cpk is not reported. '}Ppk is ${f(indexValue)}.`
  const ppm =
    input.ppmOverall !== null && input.yieldText
      ? `The estimated overall nonconformance rate is ${input.ppmOverall.toFixed(1)} PPM, corresponding to an estimated yield of ${input.yieldText}.`
      : ''
  const stability = stable
    ? ''
    : `The process is not in statistical control (${signals.length} special-cause signal(s)), so this classification describes the study period only and cannot be used to predict future performance.`
  const closing =
    'Final capability decisions should consider process stability, distribution fit, subgrouping strategy, specification validity, customer requirements, and risk associated with the product or process characteristic.'

  const base: Tone = indexValue >= CAPABLE ? 'good' : indexValue >= 1 ? 'warn' : 'bad'
  const tone: Tone = base === 'good' && (!stable || adequacyTier === 'low') ? 'warn' : base

  return { text: joinSentences(basis, ppm, stability, sizeNote, closing), tone }
}
