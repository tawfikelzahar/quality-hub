// ─────────────────────────────────────────────────────────────────────────
// "About this tool" text shown under a tool (components/tool/ToolGuide.tsx).
// Server-rendered in the page's language so search engines read it in both
// English (/spc) and Arabic (/ar/spc).
//
// Rules for writing a guide:
//   • Every number in an example comes from the site's own calculation on
//     the tool's "Try an example" data (or a golden dataset), never typed
//     from memory. Note in the file which test or script it was checked with.
//   • Formulas and rules match the code that runs on the server.
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
  sections: GuideSection[]
  /** Sources, one per line */
  references: string[]
}

export interface ToolGuide {
  en: GuideCopy
  ar: GuideCopy
}
