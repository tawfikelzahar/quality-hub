// ─────────────────────────────────────────────────────────────────────────
// Gage R&R calculations — server only (/api/gage-rr calls them, ESLint keeps
// this file out of the browser). Moved here unchanged from the route so the
// golden test can run them without a server or a Pro session.
//
// Average & Range: AIAG MSA 4th ed., Ch. III Sec. B with Minitab's d2* (App. C) constants (D4; 6σ study
// variation for %Tolerance). ANOVA: crossed two-factor random model,
// interaction pooled into repeatability when its p > α (variance components
// by the method of moments, AIAG MSA 4th ed. Appendix A).
// Checked in tests/golden/gage/check.mts against the AIAG worked example
// (Fig. III-B 16 p. 119 and Appendix A Tables A 4 / A 5).
// ─────────────────────────────────────────────────────────────────────────

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

// D4 — Range chart UCL constant, keyed by number of trials per part (exact
// control-chart table: D4 = 1 + 3·d3/d2 → 3.267, 2.574, 2.282, 2.114; Montgomery
// Appendix VI; AIAG prints them to 2 decimals, 3.27 and 2.58)
const D4: Record<number, number> = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114 }

// 6σ Study Variation. AIAG MSA 4th ed. (p. 123): percent of tolerance is found by
// "substituting the value of tolerance divided by six" for TV; Appendix B (p. 199):
// "k is normally taken to be 6". 5.15 belonged to the 2nd edition (1995). Minitab's
// default is also 6.
// K1/K2/K3 above already give 1-sigma EV/AV/GRR/PV; this multiplier is applied ONLY when
// comparing against an external Tolerance — %Contribution-of-TV and NDC are scale-invariant
// and don't need it.
const SIGMA_MULTIPLIER = 6

// Average & Range constants — the same d2* rules Minitab's Crossed Gage R&R
// (Xbar and R) uses: d2* from AIAG MSA 4th ed. Appendix C, looked up with
//   repeatability    m = trials,     g = parts × appraisers
//   reproducibility  m = appraisers, g = 1
//   part-to-part     m = parts,      g = 1
// (Minitab, "Methods and formulas for gage R&R table"). K1/K2/K3 = 1/d2*.
// The AIAG worksheet K1 0.8862 / 0.5908 is only the g > 20 row: with
// 2 appraisers × 10 parts (g = 20) Minitab uses d2* = 1.14437, not 1.12838.
// Values are the table AS PRINTED (5 decimals) — Minitab uses the printed
// figures: the exact value for m = 3, g = 1 is 1.911540 but Minitab's results
// only reproduce with the printed 1.91155 (checked on GR00–GR06).
// Every cell below was cross-checked against an independent calculation
// (Patnaik d2* = √(d2² + d3²/g), d2/d3 by numerical integration): all agree
// to within 1 in the 5th decimal (Duncan's original rounding).
// Repeatability needs m = trials (2 or 3) for g = 1–20 and the g > 20 row;
// reproducibility / part-to-part need the g = 1 row for m = 2–10.
const D2STAR_G1: Record<number, number> = {
  2: 1.41421, 3: 1.91155, 4: 2.23887, 5: 2.48124, 6: 2.67253,
  7: 2.82981, 8: 2.96288, 9: 3.07794, 10: 3.17905,
}
const D2STAR_BY_G: Record<number, number[]> = { // index g − 1, g = 1…20
  2: [1.41421, 1.27931, 1.23105, 1.20621, 1.19105, 1.18083, 1.17348, 1.16794, 1.16361, 1.16014,
    1.15729, 1.15490, 1.15289, 1.15115, 1.14965, 1.14833, 1.14717, 1.14613, 1.14520, 1.14437],
  3: [1.91155, 1.80538, 1.76858, 1.74989, 1.73857, 1.73099, 1.72555, 1.72147, 1.71828, 1.71573,
    1.71363, 1.71189, 1.71041, 1.70914, 1.70804, 1.70708, 1.70623, 1.70547, 1.70480, 1.70419],
}
const D2_G_OVER_20: Record<number, number> = { 2: 1.12838, 3: 1.69257 } // Appendix C last row (= d2)
function d2Star(m: number, g: number): number {
  if (g === 1) return D2STAR_G1[m]
  return g > 20 ? D2_G_OVER_20[m] : D2STAR_BY_G[m][g - 1]
}

// Number of distinct categories, as Minitab: 1.41 × σparts / σgage, truncated,
// and set to 1 when the value is below 1 (Minitab, "Methods and formulas for
// number of distinct categories").
function distinctCategories(PV: number, GRR: number) {
  const ndcRaw = GRR > 0 ? 1.41 * (PV / GRR) : Infinity
  const ndc = Number.isFinite(ndcRaw) ? Math.max(1, Math.floor(ndcRaw)) : Math.floor(ndcRaw)
  return { ndcRaw, ndc }
}

export interface GageInput {
  appraiserNames: string[]                // length = numAppraisers
  numTrials: number                       // 2 or 3
  numParts: number                        // 2–10
  // measurements[appraiserIdx][partIdx][trialIdx]
  measurements: (number | null)[][][]
  USL?: number | null
  LSL?: number | null
}

export function runGageRR(input: GageInput) {
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
  const k1 = 1 / d2Star(numTrials, numParts * numAppraisers)
  const EV = rBar * k1

  // Reproducibility (Appraiser Variation)
  const xbarByAppraiser = avg.map(row => mean(row))
  const xbarDiff = Math.max(...xbarByAppraiser) - Math.min(...xbarByAppraiser)
  const k2 = 1 / d2Star(numAppraisers, 1)
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
  const k3 = 1 / d2Star(numParts, 1)
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
  // AIAG MSA 4th ed. K1/K2/K3 (used above) yield 1-sigma EV/AV/GRR/PV.
  // %Tolerance compares the 6-sigma "Study Variation" with the tolerance, i.e.
  // %Tolerance = (6 × component) / Tolerance = component / (Tolerance / 6) — AIAG MSA 4th ed. p. 123.
  // (This distinction doesn't affect %Contribution-of-TV or NDC, since the same
  // multiplier would cancel out in those ratios — it only matters for %Tolerance.)
  const studyVar = { EV: EV * SIGMA_MULTIPLIER, AV: AV * SIGMA_MULTIPLIER, GRR: GRR * SIGMA_MULTIPLIER, PV: PV * SIGMA_MULTIPLIER, TV: TV * SIGMA_MULTIPLIER }
  const pctOfTolerance = tolerance
    ? { EV: studyVar.EV / tolerance, AV: studyVar.AV / tolerance, GRR: studyVar.GRR / tolerance, PV: studyVar.PV / tolerance }
    : null

  const { ndcRaw, ndc } = distinctCategories(PV, GRR)

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
    pctOfTV, pctOfTolerance, tolerance, studyVar,
    ndcRaw, ndc, conclusion, conclusionText,
    // shown in the result hint — rounded for display; the calculation keeps full precision
    constants: { D4: d4, K1: +k1.toFixed(4), K2: +k2.toFixed(4), K3: +k3.toFixed(4) },
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

export function runAnovaGageRR(input: GageInput, poolingAlpha: number) {
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

  // If the interaction is not significant at α (default 0.05 — the leading
  // statistical package's current default; older AIAG practice used 0.25,
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
  const pctStudyVar = { // std-dev-based (ratio, independent of the 6σ multiplier) — Minitab "% Study Var"
    EV: TV > 0 ? EV / TV : 0,
    AV: TV > 0 ? AV / TV : 0,
    GRR: TV > 0 ? GRR / TV : 0,
    PV: TV > 0 ? PV / TV : 0,
  }
  const studyVar = { EV: EV * SIGMA_MULTIPLIER, AV: AV * SIGMA_MULTIPLIER, GRR: GRR * SIGMA_MULTIPLIER, PV: PV * SIGMA_MULTIPLIER, TV: TV * SIGMA_MULTIPLIER }

  const tolerance = USL != null && LSL != null ? USL - LSL : null
  const pctOfTolerance = tolerance
    ? { EV: studyVar.EV / tolerance, AV: studyVar.AV / tolerance, GRR: studyVar.GRR / tolerance, PV: studyVar.PV / tolerance }
    : null

  const { ndcRaw, ndc } = distinctCategories(PV, GRR)

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
