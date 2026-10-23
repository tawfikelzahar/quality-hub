import 'server-only'

import {
  buildCapabilityDiagnosis,
  buildStudyConclusion,
  buildExecutiveSummary,
  type CapabilityInput,
  type ConclusionInput,
  type SummaryInput,
  type CapabilityDiagnosis,
  type StudyConclusion,
} from '@/lib/spc/reportInterpretation'
import { capabilityReason } from '@/lib/spc/capabilityReason'
import { translations, type TKey } from '@/lib/i18n/translations'

// ─────────────────────────────────────────────────────────────────────────
// Server-side entry to the SPC interpretation (the engineering text in the
// PDF report and the reason sentence under the on-screen verdict).
//
// reportInterpretation.ts and capabilityReason.ts are unchanged; this file
// only calls them on the server so their rules never ship to the browser.
// The same inputs go in that the page used to pass, so the text is identical.
// ─────────────────────────────────────────────────────────────────────────

/** The result fields the reason sentence is written from. */
export interface ReasonSource {
  LSL: number | null
  USL: number | null
  cl_x: number
  mu: number
  sigma: number
  sdOverall: number
  isNormal: boolean
  n: number
  violations_x: { rule: number }[]
  violations_r: { rule: number }[]
  dataAdequacy: { tier: 'low' | 'moderate' | 'adequate' }
}

export interface ScreenReason {
  en: string | null
  ar: string | null
}

/** Reason under the capability verdict, in both languages (same logic as before, now on the server). */
export function screenReason(r: ReasonSource, target: number | null): ScreenReason {
  if (r.LSL === null && r.USL === null) return { en: null, ar: null }
  const diagnosis = buildCapabilityDiagnosis({
    LSL: r.LSL,
    USL: r.USL,
    target,
    center: r.cl_x,
    mu: r.mu,
    sigmaWithin: r.sigma,
    sdOverall: r.sdOverall,
    normal: r.isNormal,
    signals: [
      ...r.violations_x.map(v => ({ rule: v.rule, dispersionChart: false })),
      ...r.violations_r.map(v => ({ rule: v.rule, dispersionChart: true })),
    ],
    n: r.n,
    adequacyTier: r.dataAdequacy.tier,
  })
  if (!diagnosis) return { en: null, ar: null }
  const tr = (lang: 'en' | 'ar') => (k: TKey) => (translations[lang] as Record<string, string>)[k]
  return {
    en: capabilityReason(diagnosis.facts, r.isNormal, tr('en')),
    ar: capabilityReason(diagnosis.facts, r.isNormal, tr('ar')),
  }
}

export interface ReportTextInput {
  capability: CapabilityInput | null
  conclusion: ConclusionInput | null
  /** headline is filled here from the diagnosis, exactly as the page did */
  summary: Omit<SummaryInput, 'headline'> | null
}

export interface ReportText {
  diagnosis: Omit<CapabilityDiagnosis, 'facts'> | null
  conclusion: StudyConclusion | null
  summary: { rows: Array<[string, string]>; tone: 'good' | 'warn' | 'bad' | 'info' } | null
}

/** The interpretation blocks of the SPC PDF report. */
export function buildReportText(input: ReportTextInput): ReportText {
  const full = input.capability ? buildCapabilityDiagnosis(input.capability) : null
  const conclusion = input.conclusion ? buildStudyConclusion(input.conclusion) : null
  const summary = input.summary
    ? buildExecutiveSummary({ ...input.summary, headline: full ? full.headline : null })
    : null
  let diagnosis: ReportText['diagnosis'] = null
  if (full) {
    const { basis, rows, recommendedAction, headline, tone } = full
    diagnosis = { basis, rows, recommendedAction, headline, tone }
  }
  return { diagnosis, conclusion, summary }
}
