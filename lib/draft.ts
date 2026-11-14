// ─────────────────────────────────────────────────────────────────────────
// Keeps a visitor's analysis when they leave a tool to sign in or to see
// Pro, and puts it back when they open that tool again.
//
// Before: a free visitor pasted data, pressed CSV or PDF, was sent to the
// sign-in or pricing page, and came back to an empty tool.
//
//   • What is kept is exactly what "Save project" stores (input_data and
//     results, from each tool's SaveAnalysisButton getPayload), and it is
//     put back by the same code that opens a saved project.
//   • It is written when the visitor leaves for /login, /pricing, /account
//     or /checkout (lib/exportGate.ts and components/LocaleLink.tsx), only
//     when there is a result on screen.
//   • It stays in this browser only (localStorage, never sent anywhere),
//     one per tool, for 24 hours. localStorage and not sessionStorage, so it
//     survives the email confirmation link, which opens in a new tab.
//   • It is used once: opening the tool takes it and deletes it. A saved
//     project (?id=) or an example (?example=1) in the address wins and the
//     draft is left alone.
// ─────────────────────────────────────────────────────────────────────────

import { stripLocale } from '@/lib/i18n/routing'

type Payload = { input_data: unknown; results: unknown }
type Stored = Payload & { at: number }

const KEY = 'qh-drafts'
const TTL_MS = 24 * 60 * 60 * 1000

/** The tool on screen and how to read its current data (set by SaveAnalysisButton). */
let source: { tool: string; get: () => Payload | null } | null = null

export function registerDraftSource(tool: string, get: () => Payload | null): () => void {
  const entry = { tool, get }
  source = entry
  return () => { if (source === entry) source = null }
}

function readAll(): Record<string, Stored> {
  try {
    const raw = window.localStorage.getItem(KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, Stored>) : {}
    const now = Date.now()
    for (const k of Object.keys(all)) if (!all[k] || now - all[k].at > TTL_MS) delete all[k]
    return all
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, Stored>) {
  try {
    if (Object.keys(all).length === 0) window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, JSON.stringify(all))
  } catch { /* storage full or blocked: the draft is simply not kept */ }
}

/** Keeps the current tool's data, if it has a result. Called just before leaving the page. */
export function stashDraft(): void {
  if (typeof window === 'undefined' || !source) return
  let payload: Payload | null = null
  try { payload = source.get() } catch { payload = null }
  if (!payload || payload.results === null || payload.results === undefined) return
  const all = readAll()
  all[source.tool] = { ...payload, at: Date.now() }
  writeAll(all)
}

/** Pages the visitor leaves a tool for when they sign in or look at Pro. */
const LEAVING_FOR = /^\/(login|pricing|account|checkout)(\/|$|\?)/

/** Keeps the draft when a link leads to sign-in, pricing, account or checkout. */
export function stashDraftIfLeavingFor(href: string): void {
  let path = href
  try { path = new URL(href, window.location.origin).pathname } catch { /* keep as is */ }
  if (LEAVING_FOR.test(stripLocale(path))) stashDraft()
}

/**
 * The kept data for this tool, shaped like a saved project ({ input_data,
 * results, name }), or null. Taking it deletes it.
 */
export function takeDraft(tool: string): (Payload & { name: string }) | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search)
  if (q.has('id') || q.has('example')) return null
  const all = readAll()
  const d = all[tool]
  if (!d) { writeAll(all); return null }
  delete all[tool]
  writeAll(all)
  return { input_data: d.input_data, results: d.results, name: '' }
}
