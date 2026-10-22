// ─────────────────────────────────────────────────────────────────────────
// AI Insights — server-side helpers (used ONLY by app/api/ai-insight/route.ts)
//
// Design rules:
// 1. The browser sends NUMBERS ONLY. Every field is re-validated here and
//    the prompt is built on the server, so nobody can push free text into
//    the model through this endpoint.
// 2. The capability verdict (Capable / Marginal / Not Capable) is computed
//    HERE with the same thresholds as lib/pdf/reportDesign.ts
//    classifyCapability (1.33 / 1.00). The model is told the verdict as a
//    fact, so the AI text can never disagree with the on-screen result.
// 3. The API key lives only in the ANTHROPIC_API_KEY environment variable
//    on Vercel. It is never sent to the browser.
// ─────────────────────────────────────────────────────────────────────────

export const AI_DAILY_LIMIT = 10
export const AI_DEFAULT_MODEL = 'claude-sonnet-5-5'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MAX_OUTPUT_TOKENS = 600

export const AI_TOOLS = ['xbar_r'] as const
export type AITool = (typeof AI_TOOLS)[number]
export type AILang = 'en' | 'ar'

export interface RuleCount {
  rule: number
  points: number
}

export interface VariableChartSummary {
  subgroups: number
  subgroupSize: number
  mean: number | null
  sigmaWithin: number | null
  sigmaOverall: number | null
  min: number | null
  max: number | null
  LSL: number | null
  USL: number | null
  target: number | null
  clX: number | null
  uclX: number | null
  lclX: number | null
  clR: number | null
  uclR: number | null
  Cp: number | null
  Cpk: number | null
  Pp: number | null
  Ppk: number | null
  Cpm: number | null
  ppmWithin: number | null
  ppmOverall: number | null
  normalityP: number | null
  isNormal: boolean
  dataAdequacy: 'low' | 'moderate' | 'adequate'
  xRules: RuleCount[]
  rRules: RuleCount[]
}

export interface AIInsightRequest {
  tool: AITool
  lang: AILang
  summary: VariableChartSummary
}

// ── Validation ───────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function int(v: unknown, min: number, max: number): number | null {
  const n = num(v)
  if (n === null || !Number.isInteger(n) || n < min || n > max) return null
  return n
}

function rules(v: unknown): RuleCount[] {
  if (!Array.isArray(v)) return []
  const out: RuleCount[] = []
  for (const item of v.slice(0, 32)) { // several runs per rule are now reported
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const rule = int(r.rule, 1, 8)
    const points = int(r.points, 0, 100000)
    if (rule !== null && points !== null) out.push({ rule, points })
  }
  return out
}

export function parseInsightRequest(body: unknown): AIInsightRequest | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!AI_TOOLS.includes(b.tool as AITool)) return null
  if (b.lang !== 'en' && b.lang !== 'ar') return null
  const s = b.summary as Record<string, unknown> | undefined
  if (!s || typeof s !== 'object') return null

  const subgroups = int(s.subgroups, 2, 100000)
  const subgroupSize = int(s.subgroupSize, 2, 25)
  if (subgroups === null || subgroupSize === null) return null

  const adequacy = s.dataAdequacy
  return {
    tool: b.tool as AITool,
    lang: b.lang,
    summary: {
      subgroups,
      subgroupSize,
      mean: num(s.mean),
      sigmaWithin: num(s.sigmaWithin),
      sigmaOverall: num(s.sigmaOverall),
      min: num(s.min),
      max: num(s.max),
      LSL: num(s.LSL),
      USL: num(s.USL),
      target: num(s.target),
      clX: num(s.clX),
      uclX: num(s.uclX),
      lclX: num(s.lclX),
      clR: num(s.clR),
      uclR: num(s.uclR),
      Cp: num(s.Cp),
      Cpk: num(s.Cpk),
      Pp: num(s.Pp),
      Ppk: num(s.Ppk),
      Cpm: num(s.Cpm),
      ppmWithin: num(s.ppmWithin),
      ppmOverall: num(s.ppmOverall),
      normalityP: num(s.normalityP),
      isNormal: s.isNormal === true,
      dataAdequacy: adequacy === 'low' || adequacy === 'moderate' ? adequacy : 'adequate',
      xRules: rules(s.xRules),
      rRules: rules(s.rRules),
    },
  }
}

// ── Deterministic facts (same thresholds as classifyCapability) ─────────

export function capabilityVerdict(index: number | null): string {
  if (index === null) return 'NOT AVAILABLE (no specification limits)'
  if (index >= 1.33) return 'CAPABLE (index >= 1.33)'
  if (index >= 1.0) return 'MARGINAL CAPABILITY (1.00 <= index < 1.33)'
  return 'NOT CAPABLE (index < 1.00)'
}

const NELSON_NAMES: Record<number, string> = {
  1: 'one point beyond 3 sigma',
  2: '9 points in a row on one side of the centre line',
  3: '6 points in a row steadily increasing or decreasing',
  4: '14 points in a row alternating up and down',
  5: '2 of 3 points beyond 2 sigma on the same side',
  6: '4 of 5 points beyond 1 sigma on the same side',
  7: '15 points in a row within 1 sigma (stratification)',
  8: '8 points in a row beyond 1 sigma on both sides (mixture)',
}

function f(v: number | null, digits = 4): string {
  if (v === null) return 'n/a'
  return Number(v.toPrecision(digits)).toString()
}

function ruleLines(list: RuleCount[]): string {
  if (list.length === 0) return 'none'
  return list.map((r) => `Rule ${r.rule} (${NELSON_NAMES[r.rule]}), ${r.points} point(s) involved`).join('; ')
}

export function buildUserMessage(req: AIInsightRequest): string {
  const s = req.summary
  // Verdict index: Cpk for normal data, Ppk otherwise (Cp/Cpk are still
  // reported for non-normal data, as Minitab does, but only as approximate).
  const useCpk = s.isNormal && s.Cpk !== null
  const index = useCpk ? s.Cpk : s.Ppk
  const indexName = useCpk ? 'Cpk' : 'Ppk'
  const inControl = s.xRules.length === 0 && s.rRules.length === 0
  const centeringGap = s.Cp !== null && s.Cpk !== null ? s.Cp - s.Cpk : null
  const withinVsOverall =
    s.sigmaWithin !== null && s.sigmaOverall !== null && s.sigmaWithin > 0
      ? s.sigmaOverall / s.sigmaWithin
      : null

  return [
    `Tool: Xbar-R control chart`,
    `Data: ${s.subgroups} subgroups of size ${s.subgroupSize} (${s.subgroups * s.subgroupSize} values). Data adequacy for capability: ${s.dataAdequacy}.`,
    `Process mean: ${f(s.mean)}; min ${f(s.min)}; max ${f(s.max)}`,
    `Within sigma: ${f(s.sigmaWithin)}; overall sigma: ${f(s.sigmaOverall)}; overall/within ratio: ${f(withinVsOverall, 3)}`,
    `Spec limits: LSL ${f(s.LSL)}; USL ${f(s.USL)}; target ${f(s.target)}`,
    `Xbar chart: CL ${f(s.clX)}; UCL ${f(s.uclX)}; LCL ${f(s.lclX)}`,
    `R chart: CL ${f(s.clR)}; UCL ${f(s.uclR)}`,
    `Nelson rule violations on Xbar chart: ${ruleLines(s.xRules)}`,
    `Nelson rule violations on R chart: ${ruleLines(s.rRules)}`,
    `Tests for special causes applied: Standard default tests (Xbar chart tests 1, 2, 7; R chart test 1)`,
    `Stability (computed): ${inControl ? 'NO SIGNALS — no special-cause signals detected' : 'SIGNALS PRESENT — special-cause signals detected; capability is reported with a caution'}`,
    `Cp ${f(s.Cp)}; Cpk ${f(s.Cpk)}; Pp ${f(s.Pp)}; Ppk ${f(s.Ppk)}; Cpm ${f(s.Cpm)}`,
    `Cp minus Cpk (centering gap): ${f(centeringGap, 3)}`,
    `Expected PPM out of spec: within ${f(s.ppmWithin, 6)}; overall ${f(s.ppmOverall, 6)}`,
    `Anderson-Darling normality p-value: ${s.normalityP !== null && s.normalityP < 0.005 ? '< 0.005' : f(s.normalityP, 3)} (${s.isNormal ? 'consistent with normal' : 'NOT normal at alpha 0.05 — Cp/Cpk/Pp/Ppk all assume normality and are approximate; verdict index is Ppk'})`,
    `Capability verdict (computed by the app, treat as fixed): ${indexName} → ${capabilityVerdict(index)}`,
    ``,
    `Write the interpretation in ${req.lang === 'ar' ? 'Modern Standard Arabic' : 'English'}.`,
  ].join('\n')
}

export const SYSTEM_PROMPT = `You are a senior quality engineer specialised in statistical process control (AIAG SPC manual, Montgomery) working in automotive and general manufacturing. You explain analysis results to a quality engineer on the shop floor.

Rules:
- Use ONLY the numbers given. Never invent values, causes that contradict the data, or extra statistics.
- The capability verdict and the control status are computed by the application. Restate them exactly; never upgrade or downgrade them.
- If special-cause signals are present, still state the capability verdict exactly as computed, then caution that the capability estimates may not be reliable until the signals are investigated, and make investigating the flagged points the first action.
- Identify the main issue: centering (large Cp minus Cpk gap, mean far from target), excessive variation (low Cp), instability (rule violations, overall sigma much larger than within sigma), or non-normal data. Name the dominant one first.
- Give 2 to 3 concrete, practical next actions a quality engineer can take (for example: investigate special causes at the flagged points, adjust process centering toward target, reduce common-cause variation, verify the measurement system with Gage R&R, collect more subgroups when data adequacy is low).
- Match urgency to the verdict: calm for capable processes, clear warning for not capable ones.
- Keep technical terms in English in every language: Cp, Cpk, Pp, Ppk, Cpm, PPM, LSL, USL, UCL, LCL, sigma, Nelson Rules, Xbar, R chart, Gage R&R.
- Length: 1 to 2 short paragraphs, then the actions as a short list. Plain text only: no markdown headings, no bold, no tables. Use "- " for list items.
- Do not add a disclaimer; the application shows one.`

// ── Anthropic call ───────────────────────────────────────────────────────

export interface InsightResult {
  text: string
  inputTokens: number | null
  outputTokens: number | null
}

export class InsightError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function callClaude(req: AIInsightRequest): Promise<InsightResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new InsightError('AI is not configured yet.', 503)

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || AI_DEFAULT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(req) }],
    }),
    signal: AbortSignal.timeout(45000),
  })

  if (!res.ok) {
    // The body may contain account details — log it server-side only.
    const detail = await res.text().catch(() => '')
    console.error('[ai-insight] Anthropic error', res.status, detail.slice(0, 500))
    throw new InsightError('The AI service is temporarily unavailable.', 502)
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim()
  if (!text) throw new InsightError('The AI returned an empty answer.', 502)

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  }
}
