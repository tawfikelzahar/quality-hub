import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────
// Gage R&R — AIAG Average & Range (X̄ & R) Method
// Constants verified against the official AIAG MSA reference table and
// cross-checked numerically against a confirmed Gage R&R Excel workbook
// (same source-of-truth policy as the AQL Ac/Re table: never inferred).
// ─────────────────────────────────────────────────────────────────────────

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ── F-distribution p-value machinery ────────────────────────────────────
// Regularized incomplete beta function (Numerical Recipes / Lentz continued
// fraction) — used for exact F-test p-values with no external stats library.
// Verified numerically against scipy.stats.f.cdf on the reference dataset.
function gammln(x: number): number {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) { y += 1; ser += cof[j] / y }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(gammln(a + b) - gammln(a) - gammln(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

// P(F >= f) for F ~ F(df1, df2) — the F-test p-value
function fPValue(f: number, df1: number, df2: number): number {
  if (!Number.isFinite(f) || f <= 0) return 1
  if (df1 <= 0 || df2 <= 0) return 1
  const x = (df1 * f) / (df1 * f + df2)
  return 1 - betai(df1 / 2, df2 / 2, x)
}

// D4 — Range chart UCL constant, keyed by number of trials per part
const D4: Record<number, number> = { 2: 3.267, 3: 2.575, 4: 2.282, 5: 2.114 }

// K1 — Repeatability (EV) constant, keyed by number of trials
const K1: Record<number, number> = { 2: 0.8862, 3: 0.5908 }

// K2 — Reproducibility (AV) constant, keyed by number of appraisers
const K2: Record<number, number> = { 2: 0.7071, 3: 0.5231 }

// K3 — Part Variation (PV) constant, keyed by number of parts (2–10)
const K3: Record<number, number> = {
  2: 0.7071, 3: 0.5231, 4: 0.4467, 5: 0.4030, 6: 0.3742,
  7: 0.3534, 8: 0.3375, 9: 0.3249, 10: 0.3146,
}

interface GageInput {
  appraiserNames: string[]                // length = numAppraisers
  numTrials: number                       // 2 or 3
  numParts: number                        // 2–10
  // measurements[appraiserIdx][partIdx][trialIdx]
  measurements: (number | null)[][][]
  USL?: number | null
  LSL?: number | null
}

function runGageRR(input: GageInput) {
  const { appraiserNames, numTrials, numParts, measurements, USL, LSL } = input
  const numAppraisers = appraiserNames.length

  if (numAppraisers !== 2 && numAppraisers !== 3) {
    throw new Error('Number of appraisers must be 2 or 3 (verified AIAG K2 table only covers 2–3).')
  }
  if (numTrials !== 2 && numTrials !== 3) {
    throw new Error('Number of trials must be 2 or 3 (verified AIAG K1 table only covers 2–3).')
  }
  if (numParts < 2 || numParts > 10) {
    throw new Error('Number of parts must be between 2 and 10 (verified AIAG K3 table range).')
  }
  for (let a = 0; a < numAppraisers; a++) {
    for (let p = 0; p < numParts; p++) {
      for (let t = 0; t < numTrials; t++) {
        const v = measurements?.[a]?.[p]?.[t]
        if (v === null || v === undefined || Number.isNaN(v)) {
          throw new Error(`Missing measurement — Appraiser ${appraiserNames[a] || a + 1}, Part ${p + 1}, Trial ${t + 1}.`)
        }
      }
    }
  }

  // Per appraiser × part: average and range across trials
  const avg: number[][] = [] // [appraiser][part]
  const rng: number[][] = [] // [appraiser][part]
  for (let a = 0; a < numAppraisers; a++) {
    avg.push([])
    rng.push([])
    for (let p = 0; p < numParts; p++) {
      const trials = measurements[a][p] as number[]
      avg[a].push(mean(trials))
      rng[a].push(Math.max(...trials) - Math.min(...trials))
    }
  }

  // Range chart: per-appraiser Rbar, overall Rbar, UCL
  const rBarByAppraiser = avg.map((_, a) => mean(rng[a]))
  const rBar = mean(rBarByAppraiser)
  const d4 = D4[numTrials]
  const uclR = rBar * d4
  const outOfControlRanges: { appraiser: string; part: number; range: number }[] = []
  for (let a = 0; a < numAppraisers; a++) {
    for (let p = 0; p < numParts; p++) {
      if (rng[a][p] > uclR) {
        outOfControlRanges.push({ appraiser: appraiserNames[a], part: p + 1, range: rng[a][p] })
      }
    }
  }

  // Repeatability (Equipment Variation)
  const k1 = K1[numTrials]
  const EV = rBar * k1

  // Reproducibility (Appraiser Variation)
  const xbarByAppraiser = avg.map(row => mean(row))
  const xbarDiff = Math.max(...xbarByAppraiser) - Math.min(...xbarByAppraiser)
  const k2 = K2[numAppraisers]
  const avRawSq = (xbarDiff * k2) ** 2 - (EV ** 2) / (numParts * numTrials)
  const AV = Math.sqrt(Math.max(0, avRawSq))

  // Gage R&R
  const GRR = Math.sqrt(EV ** 2 + AV ** 2)

  // Part Variation
  const partAvg: number[] = []
  for (let p = 0; p < numParts; p++) {
    partAvg.push(mean(avg.map(a => a[p])))
  }
  const rP = Math.max(...partAvg) - Math.min(...partAvg)
  const k3 = K3[numParts]
  const PV = rP * k3

  // Total Variation
  const TV = Math.sqrt(GRR ** 2 + PV ** 2)

  const pctOfTV = {
    EV: TV > 0 ? EV / TV : 0,
    AV: TV > 0 ? AV / TV : 0,
    GRR: TV > 0 ? GRR / TV : 0,
    PV: TV > 0 ? PV / TV : 0,
  }

  const tolerance = USL != null && LSL != null ? USL - LSL : null
  const pctOfTolerance = tolerance
    ? { EV: EV / tolerance, AV: AV / tolerance, GRR: GRR / tolerance, PV: PV / tolerance }
    : null

  const ndcRaw = GRR > 0 ? 1.41 * (PV / GRR) : Infinity
  const ndc = Math.floor(ndcRaw)

  // Conclusion — prefer %GRR of Tolerance when specs are provided, else %GRR of Total Variation
  const gaugeForConclusion = pctOfTolerance ? pctOfTolerance.GRR : pctOfTV.GRR
  let conclusion: 'okay' | 'marginal' | 'unacceptable'
  let conclusionText: string
  if (gaugeForConclusion < 0.1) {
    conclusion = 'okay'
    conclusionText = 'Gage system is acceptable.'
  } else if (gaugeForConclusion <= 0.3) {
    conclusion = 'marginal'
    conclusionText = 'Gage system may be acceptable depending on application importance and cost of measurement.'
  } else {
    conclusion = 'unacceptable'
    conclusionText = 'Gage system is unacceptable — investigate measurement process.'
  }

  return {
    appraiserNames, numAppraisers, numTrials, numParts,
    avg, rng, rBarByAppraiser, rBar, uclR, outOfControlRanges,
    EV, xbarByAppraiser, xbarDiff, AV, GRR,
    partAvg, rP, PV, TV,
    pctOfTV, pctOfTolerance, tolerance,
    ndcRaw, ndc, conclusion, conclusionText,
    constants: { D4: d4, K1: k1, K2: k2, K3: k3 },
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Gage R&R — Crossed Two-Factor ANOVA Method (Part, Appraiser, Part×Appraiser)
// This is the statistically rigorous alternative to Average & Range: it
// partitions total variation into named sources with an F-test (and exact
// p-value) for each, so "is this difference real or just noise" has an
// actual answer. Works for any numAppraisers ≥ 2, numTrials ≥ 2, numParts ≥ 2
// — unlike Average & Range it needs no lookup-table constants.
// ─────────────────────────────────────────────────────────────────────────

interface AnovaSource {
  source: string
  SS: number
  df: number
  MS: number
  F: number | null
  p: number | null
  significant: boolean | null
}

function runAnovaGageRR(input: GageInput, poolingAlpha: number) {
  const { appraiserNames, numTrials, numParts, measurements, USL, LSL } = input
  const numAppraisers = appraiserNames.length
  const k = numAppraisers, n = numParts, r = numTrials

  if (k < 2) throw new Error('ANOVA method needs at least 2 appraisers.')
  if (r < 2) throw new Error('ANOVA method needs at least 2 trials per part (to estimate repeatability and interaction).')
  if (n < 2) throw new Error('ANOVA method needs at least 2 parts.')
  for (let a = 0; a < k; a++) {
    for (let p = 0; p < n; p++) {
      for (let t = 0; t < r; t++) {
        const v = measurements?.[a]?.[p]?.[t]
        if (v === null || v === undefined || Number.isNaN(v)) {
          throw new Error(`Missing measurement — Appraiser ${appraiserNames[a] || a + 1}, Part ${p + 1}, Trial ${t + 1}.`)
        }
      }
    }
  }

  const data = measurements as number[][][] // [a][p][t]
  const grand = mean(data.flat(2))

  const partMean: number[] = []
  for (let p = 0; p < n; p++) partMean.push(mean(data.map(a => a[p]).flat()))

  const apprMean: number[] = data.map(a => mean(a.flat()))

  const cellMean: number[][] = data.map(a => a.map(trials => mean(trials))) // [a][p]

  let SS_total = 0
  for (let a = 0; a < k; a++) for (let p = 0; p < n; p++) for (let t = 0; t < r; t++) {
    SS_total += (data[a][p][t] - grand) ** 2
  }
  const SS_part = k * r * partMean.reduce((s, m) => s + (m - grand) ** 2, 0)
  const SS_appr = n * r * apprMean.reduce((s, m) => s + (m - grand) ** 2, 0)
  let SS_inter = 0
  for (let a = 0; a < k; a++) for (let p = 0; p < n; p++) {
    SS_inter += (cellMean[a][p] - apprMean[a] - partMean[p] + grand) ** 2
  }
  SS_inter *= r
  const SS_error = Math.max(0, SS_total - SS_part - SS_appr - SS_inter)

  const df_part = n - 1
  const df_appr = k - 1
  const df_inter = (n - 1) * (k - 1)
  const df_error = n * k * (r - 1)

  const MS_part = SS_part / df_part
  const MS_appr = SS_appr / df_appr
  const MS_inter = df_inter > 0 ? SS_inter / df_inter : 0
  const MS_error = df_error > 0 ? SS_error / df_error : 0

  // Unpooled table — Part & Appraiser tested against the interaction term
  const F_part = MS_inter > 0 ? MS_part / MS_inter : null
  const F_appr = MS_inter > 0 ? MS_appr / MS_inter : null
  const F_inter = MS_error > 0 ? MS_inter / MS_error : null

  const p_part = F_part !== null && df_inter > 0 ? fPValue(F_part, df_part, df_inter) : null
  const p_appr = F_appr !== null && df_inter > 0 ? fPValue(F_appr, df_appr, df_inter) : null
  const p_inter = F_inter !== null && df_error > 0 ? fPValue(F_inter, df_inter, df_error) : null

  const unpooledTable: AnovaSource[] = [
    { source: 'Part', SS: SS_part, df: df_part, MS: MS_part, F: F_part, p: p_part, significant: p_part !== null ? p_part < 0.05 : null },
    { source: 'Appraiser', SS: SS_appr, df: df_appr, MS: MS_appr, F: F_appr, p: p_appr, significant: p_appr !== null ? p_appr < 0.05 : null },
    { source: 'Part × Appraiser', SS: SS_inter, df: df_inter, MS: MS_inter, F: F_inter, p: p_inter, significant: p_inter !== null ? p_inter < 0.05 : null },
    { source: 'Repeatability (Error)', SS: SS_error, df: df_error, MS: MS_error, F: null, p: null, significant: null },
  ]

  // AIAG convention: if the interaction is not significant (default α = 0.25,
  // more lenient than 0.05 because the interaction term usually has low power),
  // pool it into the error term and re-test Part & Appraiser against the pooled error.
  const shouldPool = p_inter !== null && p_inter > poolingAlpha && df_inter > 0
  let anovaTable = unpooledTable
  let pooled = false
  let MS_error_final = MS_error
  let df_error_final = df_error
  let usedInteractionVar = true

  if (shouldPool) {
    pooled = true
    usedInteractionVar = false
    const SS_error_pooled = SS_inter + SS_error
    const df_error_pooled = df_inter + df_error
    const MS_error_pooled = df_error_pooled > 0 ? SS_error_pooled / df_error_pooled : 0
    const F_part_p = MS_error_pooled > 0 ? MS_part / MS_error_pooled : null
    const F_appr_p = MS_error_pooled > 0 ? MS_appr / MS_error_pooled : null
    const p_part_p = F_part_p !== null && df_error_pooled > 0 ? fPValue(F_part_p, df_part, df_error_pooled) : null
    const p_appr_p = F_appr_p !== null && df_error_pooled > 0 ? fPValue(F_appr_p, df_appr, df_error_pooled) : null
    anovaTable = [
      { source: 'Part', SS: SS_part, df: df_part, MS: MS_part, F: F_part_p, p: p_part_p, significant: p_part_p !== null ? p_part_p < 0.05 : null },
      { source: 'Appraiser', SS: SS_appr, df: df_appr, MS: MS_appr, F: F_appr_p, p: p_appr_p, significant: p_appr_p !== null ? p_appr_p < 0.05 : null },
      { source: 'Repeatability (Error, pooled)', SS: SS_error_pooled, df: df_error_pooled, MS: MS_error_pooled, F: null, p: null, significant: null },
    ]
    MS_error_final = MS_error_pooled
    df_error_final = df_error_pooled
  }

  // Variance components (method of moments)
  const var_error = MS_error_final
  const var_inter = usedInteractionVar ? Math.max(0, (MS_inter - MS_error) / r) : 0
  const var_appr = usedInteractionVar
    ? Math.max(0, (MS_appr - MS_inter) / (n * r))
    : Math.max(0, (MS_appr - MS_error_final) / (n * r))
  const var_part = usedInteractionVar
    ? Math.max(0, (MS_part - MS_inter) / (k * r))
    : Math.max(0, (MS_part - MS_error_final) / (k * r))

  const var_EV = var_error
  const var_AV = var_appr + var_inter
  const var_GRR = var_EV + var_AV
  const var_PV = var_part
  const var_TV = var_GRR + var_PV

  const sd = (v: number) => Math.sqrt(Math.max(0, v))
  const EV = sd(var_EV), AV = sd(var_AV), GRR = sd(var_GRR), PV = sd(var_PV), TV = sd(var_TV)

  const pctContribution = { // variance-based (Minitab "% Contribution")
    EV: var_TV > 0 ? var_EV / var_TV : 0,
    AV: var_TV > 0 ? var_AV / var_TV : 0,
    GRR: var_TV > 0 ? var_GRR / var_TV : 0,
    PV: var_TV > 0 ? var_PV / var_TV : 0,
  }
  const pctStudyVar = { // std-dev-based, 5.15σ (99% spread) — Minitab "% Study Var"
    EV: TV > 0 ? EV / TV : 0,
    AV: TV > 0 ? AV / TV : 0,
    GRR: TV > 0 ? GRR / TV : 0,
    PV: TV > 0 ? PV / TV : 0,
  }
  const SIGMA_MULTIPLIER = 5.15
  const studyVar = { EV: EV * SIGMA_MULTIPLIER, AV: AV * SIGMA_MULTIPLIER, GRR: GRR * SIGMA_MULTIPLIER, PV: PV * SIGMA_MULTIPLIER, TV: TV * SIGMA_MULTIPLIER }

  const tolerance = USL != null && LSL != null ? USL - LSL : null
  const pctOfTolerance = tolerance
    ? { EV: studyVar.EV / tolerance, AV: studyVar.AV / tolerance, GRR: studyVar.GRR / tolerance, PV: studyVar.PV / tolerance }
    : null

  const ndcRaw = GRR > 0 ? 1.41 * (PV / GRR) : Infinity
  const ndc = Math.floor(ndcRaw)

  const gaugeForConclusion = pctOfTolerance ? pctOfTolerance.GRR : pctStudyVar.GRR
  let conclusion: 'okay' | 'marginal' | 'unacceptable'
  let conclusionText: string
  if (gaugeForConclusion < 0.1) {
    conclusion = 'okay'; conclusionText = 'Gage system is acceptable.'
  } else if (gaugeForConclusion <= 0.3) {
    conclusion = 'marginal'; conclusionText = 'Gage system may be acceptable depending on application importance and cost of measurement.'
  } else {
    conclusion = 'unacceptable'; conclusionText = 'Gage system is unacceptable — investigate measurement process.'
  }

  const apprSig = anovaTable.find(r => r.source === 'Appraiser')
  const interSig = unpooledTable.find(r => r.source === 'Part × Appraiser')
  let significanceNote = ''
  if (interSig?.p !== null && interSig?.p !== undefined) {
    significanceNote += pooled
      ? `Part × Appraiser interaction not significant (p = ${interSig.p.toFixed(4)}) — pooled into the error term per AIAG convention (α = ${poolingAlpha}). `
      : `Part × Appraiser interaction is significant (p = ${interSig.p.toFixed(4)}) — appraisers are inconsistent on specific parts; kept in the model. `
  }
  if (apprSig?.p !== null && apprSig?.p !== undefined) {
    significanceNote += apprSig.significant
      ? `Differences between appraisers ARE statistically significant (p = ${apprSig.p.toFixed(4)}).`
      : `Differences between appraisers are NOT statistically significant (p = ${apprSig.p.toFixed(4)}) — observed gaps are consistent with random noise.`
  }

  return {
    appraiserNames, numAppraisers, numTrials, numParts,
    avg: cellMean, partAvg: partMean, xbarByAppraiser: apprMean,
    grandMean: grand,
    anovaTable, unpooledInteraction: unpooledTable.find(r => r.source === 'Part × Appraiser'),
    pooled, poolingAlpha, errorDf: df_error_final,
    EV, AV, GRR, PV, TV,
    varComponents: { EV: var_EV, AV: var_AV, GRR: var_GRR, PV: var_PV, TV: var_TV },
    pctContribution, pctStudyVar, studyVar,
    pctOfTolerance, tolerance,
    ndcRaw, ndc, conclusion, conclusionText, significanceNote,
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GageInput & { method?: 'average-range' | 'anova'; poolingAlpha?: number }
    if (!body || !Array.isArray(body.measurements) || !Array.isArray(body.appraiserNames)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }
    const result = body.method === 'anova'
      ? runAnovaGageRR(body, body.poolingAlpha ?? 0.25)
      : runGageRR(body)
    return NextResponse.json({ method: body.method === 'anova' ? 'anova' : 'average-range', ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Calculation error: ' + message }, { status: 400 })
  }
}
