import 'server-only'

// ─────────────────────────────────────────────────────────────────────────
// Gage R&R report interpretation — "Measurement System Diagnosis", the
// page-1 Summary and the Recommended Action of the PDF report.
//
// Runs on the server only and reads the numbers the Gage R&R engine already
// produced (app/api/gage-rr/route.ts); it computes no new statistics, only
// shares and comparisons for the wording. Same thresholds as the engine's
// verdict: < 10% acceptable, 10–30% marginal, > 30% unacceptable; ndc ≥ 5.
//
// Guidance follows the usual MSA reading of the results (AIAG MSA manual):
//   • repeatability (EV) dominant → the gage: condition / maintenance, design,
//     part location and clamping, within-part variation
//   • reproducibility (AV) dominant → the appraisers: method, training,
//     fixtures, readable graduations
//   • %GRR of tolerance → product acceptance; %GRR of total variation →
//     process control and improvement studies
// ─────────────────────────────────────────────────────────────────────────

export type Tone = 'good' | 'warn' | 'bad' | 'info'

export interface GageDiagnosisRow {
  dimension: string
  result: string
  assessment: string
  tone: Tone
}

export interface GageDiagnosis {
  rows: GageDiagnosisRow[]
  summary: Array<[string, string]>
  recommendedAction: string
  tone: Tone
}

interface Pct { EV: number; AV: number; GRR: number; PV: number }

export interface GageResultForDiagnosis {
  method: 'average-range' | 'anova'
  EV: number
  AV: number
  GRR: number
  PV: number
  ndc: number
  ndcRaw: number
  conclusion: 'okay' | 'marginal' | 'unacceptable'
  pctOfTolerance: Pct | null
  pctOfTV?: Pct
  pctStudyVar?: Pct
  outOfControlRanges?: { appraiser: string; part: number; range: number }[]
  pooled?: boolean
  unpooledInteraction?: { p: number | null } | undefined
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
type Band = 'acceptable' | 'marginal' | 'unacceptable'
const band = (x: number): Band => (x < 0.1 ? 'acceptable' : x <= 0.3 ? 'marginal' : 'unacceptable')
const toneOf = (b: Band): Tone => (b === 'acceptable' ? 'good' : b === 'marginal' ? 'warn' : 'bad')
const firstSentence = (s: string) => s.split(/(?<=\.)\s/)[0]

export function buildGageDiagnosis(r: GageResultForDiagnosis): GageDiagnosis {
  const tv = (r.method === 'anova' ? r.pctStudyVar : r.pctOfTV) ?? { EV: 0, AV: 0, GRR: 0, PV: 0 }
  const tol = r.pctOfTolerance
  const basisPct = tol ? tol.GRR : tv.GRR
  const basisName = tol ? 'of Tolerance' : 'of Total Variation'
  // Same verdict as the engine (it already applied the 10% / 30% bands)
  const verdict: Band = r.conclusion === 'okay' ? 'acceptable' : r.conclusion === 'marginal' ? 'marginal' : 'unacceptable'
  const rows: GageDiagnosisRow[] = []

  // 1 · Overall measurement error against the verdict basis
  const verdictText: Record<Band, string> = {
    acceptable: tol
      ? 'Below the 10% guideline: the gage error is small compared with the tolerance.'
      : 'Below the 10% guideline: the gage error is small compared with the variation in this study.',
    marginal: 'Between 10% and 30%: may be acceptable depending on how important the characteristic is and the cost of a better gage.',
    unacceptable: tol
      ? 'Above 30%: the gage error is too large for this tolerance. Improve the measurement system before using it for accept / reject decisions.'
      : 'Above 30%: the gage error is too large compared with the variation in this study. Improve the measurement system before relying on it.',
  }
  rows.push({ dimension: 'Measurement Error (%GRR)', result: `${pct(basisPct)} ${basisName}`, assessment: verdictText[verdict], tone: toneOf(verdict) })

  // 2 · When judged on tolerance, also say how it does for process control
  let tvBand: Band | null = null
  if (tol) {
    tvBand = band(tv.GRR)
    const tvText: Record<Band, string> = {
      acceptable: 'Also below 10% of the total variation, so the gage is suitable for SPC and process improvement studies too.',
      marginal: 'Against the total variation it is between 10% and 30%: usable for SPC with caution.',
      unacceptable: 'Against the total variation it is above 30%: for SPC, capability or improvement studies a more precise gage is needed.',
    }
    rows.push({ dimension: 'Process Control Use', result: `${pct(tv.GRR)} of Total Variation`, assessment: tvText[tvBand], tone: toneOf(tvBand) })
  }

  // 3 · Where the error comes from (shares of the GRR variance)
  type Source = 'none' | 'repeatability' | 'reproducibility' | 'both'
  let source: Source = 'none'
  if (r.GRR > 0) {
    const evShare = (r.EV * r.EV) / (r.GRR * r.GRR)
    const avShare = 1 - evShare
    source = evShare >= 0.75 ? 'repeatability' : evShare <= 0.25 ? 'reproducibility' : 'both'
    const avZero = r.AV === 0
      ? ' AV is 0: the differences between appraisers are no larger than repeatability alone would explain.'
      : ''
    const sourceText: Record<Exclude<Source, 'none'>, string> = {
      repeatability: 'Most of the measurement error comes from the gage itself: the same appraiser does not get the same reading on the same part.' + avZero,
      reproducibility: 'Most of the measurement error comes from differences between appraisers: each one is consistent, but they read the parts differently.',
      both: 'Repeatability and reproducibility both contribute: the gage and the measuring method between appraisers both need attention.',
    }
    const label: Record<Exclude<Source, 'none'>, string> = {
      repeatability: 'Repeatability (equipment)',
      reproducibility: 'Reproducibility (appraisers)',
      both: 'Repeatability and reproducibility',
    }
    rows.push({
      dimension: 'Main Source of Error',
      result: `${label[source]} · EV ${pct(evShare)} / AV ${pct(avShare)} of GRR variance`,
      assessment: sourceText[source],
      tone: 'info',
    })
  } else {
    rows.push({ dimension: 'Main Source of Error', result: 'No measurable gage error', assessment: 'Repeated readings and appraisers agreed exactly in this study.', tone: 'good' })
  }

  // 4 · Discrimination (ndc)
  const ndcOk = r.ndc >= 5
  const ndcText = !isFinite(r.ndcRaw)
    ? 'No measurable gage error, so discrimination is not limited by the gage.'
    : ndcOk
    ? `The gage separates the parts into ${r.ndc} distinct groups: adequate (guideline: at least 5).`
    : `Only ${r.ndc} distinct group(s): below the guideline of 5, so the gage cannot reliably tell parts apart within this spread of parts.`
  rows.push({ dimension: 'Discrimination (ndc)', result: isFinite(r.ndcRaw) ? `ndc = ${r.ndc}` : 'ndc not limited', assessment: ndcText, tone: ndcOk || !isFinite(r.ndcRaw) ? 'good' : 'bad' })

  // 5 · Consistency of the readings
  const ooc = r.outOfControlRanges?.length ?? 0
  let consistencyIssue = false
  if (r.method === 'average-range') {
    consistencyIssue = ooc > 0
    rows.push({
      dimension: 'Appraiser Consistency',
      result: ooc === 0 ? 'No ranges above the UCL' : `${ooc} range(s) above the UCL`,
      assessment: ooc === 0
        ? 'Every appraiser repeats consistently across the parts.'
        : 'Some repeated readings disagree more than expected. Check those parts and readings (recording errors, part handling, measuring point) before trusting the study.',
      tone: ooc === 0 ? 'good' : 'warn',
    })
  } else {
    const p = r.unpooledInteraction?.p ?? null
    consistencyIssue = r.pooled === false
    rows.push({
      dimension: 'Appraiser Consistency',
      result: p === null ? 'Part × Appraiser: n/a' : `Part × Appraiser p = ${p.toFixed(4)}`,
      assessment: r.pooled === false
        ? 'The interaction is significant: appraisers measure some parts differently (often part features or a measuring point that is not well defined).'
        : 'No significant Part × Appraiser interaction: appraisers treat all parts the same way.',
      tone: r.pooled === false ? 'warn' : 'good',
    })
  }

  // Recommended action
  const parts: string[] = []
  if (consistencyIssue && r.method === 'average-range') {
    parts.push('Investigate the out-of-control ranges first: re-measure or correct those readings, then repeat the analysis.')
  }
  if (verdict === 'acceptable') {
    parts.push(
      (tol
        ? 'The gage error is small against the tolerance, so the gage is suitable for accept / reject decisions on this characteristic.'
        : 'The measurement system is suitable for this use.') +
      ' Keep it under periodic verification: calibration, and a repeat study after any change to the gage, the method or the appraisers.'
    )
  } else if (source === 'repeatability') {
    parts.push('Focus on the gage: check its condition and maintenance, how the part is located and clamped, and that the measuring point is clearly defined. Large within-part variation (form, taper, out-of-round) also shows up as repeatability.')
  } else if (source === 'reproducibility') {
    parts.push('Focus on the appraisers: one written measuring method, training on it, a fixture that removes differences in technique, and clear, readable graduations on the gage.')
  } else if (source === 'both') {
    parts.push('Work on both: the gage (condition, part location and clamping, measuring point) and the method between appraisers (one written procedure, training, fixtures).')
  }
  if (consistencyIssue && r.method === 'anova') {
    parts.push('Review how the appraisers measure the parts they disagree on: part features, the measuring point and how the part is held.')
  }
  if (tvBand && verdict !== 'unacceptable' && tvBand === 'unacceptable') {
    parts.push('If this gage will also be used for SPC or capability studies, its error is large compared with the process variation: use a more precise gage for that purpose.')
  }
  if (isFinite(r.ndcRaw) && !ndcOk) {
    parts.push('For discrimination, first confirm that the study parts cover the real process range, then consider a gage with finer resolution.')
  }
  const recommendedAction = parts.join(' ')

  const verdictLabel: Record<Band, string> = { acceptable: 'Acceptable', marginal: 'Marginal', unacceptable: 'Unacceptable' }
  const sourceShort: Record<Source, string> = {
    none: 'No measurable gage error',
    repeatability: 'Repeatability (equipment)',
    reproducibility: 'Reproducibility (appraisers)',
    both: 'Repeatability and reproducibility',
  }
  const summary: Array<[string, string]> = [
    ['Verdict', `${verdictLabel[verdict]} — %GRR ${pct(basisPct)} ${basisName}`],
    ['Main source', sourceShort[source]],
    ['Discrimination', isFinite(r.ndcRaw) ? `ndc = ${r.ndc} (${ndcOk ? 'adequate' : 'below 5'})` : 'Not limited by the gage'],
    ['Action', firstSentence(recommendedAction)],
  ]

  return { rows, summary, recommendedAction, tone: toneOf(verdict) }
}
