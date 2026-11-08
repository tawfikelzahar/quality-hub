// ─────────────────────────────────────────────────────────────────────────
// "About this tool" text shown under a tool (components/tool/ToolGuide.tsx).
// Server-rendered in the page's language so search engines read it in both
// English (/spc) and Arabic (/ar/spc).
//
// Rules for writing a guide:
//   • Every number in an example comes from the site's own calculation on
//     the tool's "Try an example" data (or a golden dataset), never typed
//     from memory. Note in the file which test or script it was checked with.
//   • Owner's decision (30 Oct 2026): no formulas, constants, internal rules
//     or full reference tables (e.g. the ICMSF case table) on the page. Say
//     WHAT the tool does and WHICH standard it follows in plain words, show
//     the example's results only (no hand-check steps), and cite the sources.
//     Anything that would let a visitor skip the tool stays out.
//   • References by name (AIAG, ISO, Montgomery…). The specialised software
//     the results are compared with is never named.
//   • Technical terms stay in English in the Arabic text.
// ─────────────────────────────────────────────────────────────────────────

export type GuideBlock =
  | { p: string }
  | { list: string[] }
  /** Small table: first row is the header */
  | { table: string[][] }

export interface GuideSection {
  h: string
  blocks: GuideBlock[]
}

export interface GuideCopy {
  /** Section heading, e.g. "About SPC Engine" */
  title: string
  /** Line beside the title; default "How it is calculated · worked example · references" */
  sub?: string
  sections: GuideSection[]
  /** Sources, one per line */
  references: string[]
}

export interface ToolGuide {
  en: GuideCopy
  ar: GuideCopy
}
