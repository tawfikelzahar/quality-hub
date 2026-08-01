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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GageInput
    if (!body || !Array.isArray(body.measurements) || !Array.isArray(body.appraiserNames)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }
    const result = runGageRR(body)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Calculation error: ' + message }, { status: 400 })
  }
}
