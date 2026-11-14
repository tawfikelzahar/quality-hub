// ─────────────────────────────────────────────────────────────────────────
// English inside Arabic text, kept in the right order.
//
// The browser lays out a mixed line with the Unicode bidi rules. Plain words
// (Cpk, Pro, Gage R&R) come out fine, but brackets, commas, slashes and "="
// between English words take the direction of whatever is next to them, so
// on a phone "مخططات Attribute (p, np, c, u)" was drawn with the brackets
// flipped and the list out of order, and long lines broke the same way when
// they wrapped.
//
// isolateLatin() wraps each such English stretch in LRI … PDI (U+2066 /
// U+2069): an invisible "this part is left to right" marker. Simple words,
// numbers alone and Arabic are left untouched, so Arabic number style
// (e.g. 11%) does not change.
//
// Used by t() for Arabic (lib/i18n/context.tsx) and by the few other places
// that print Arabic text from data files. Strings that already carry their
// own direction marks are returned as they are.
// ─────────────────────────────────────────────────────────────────────────

const LRI = '\u2066'
const PDI = '\u2069'

/** Arabic letters, Arabic comma and semicolon: they end an English stretch */
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
/** Text that already says its own direction: left alone */
const HAS_MARKS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/
/** Latin or Greek letter (α, σ, μ count as English here) */
const LETTER = /[A-Za-z\u00C0-\u024F\u0370-\u03FF]/
/** Characters whose direction depends on their neighbours: the ones that flip */
const NEUTRAL = /[()[\]{},/=×±:·+\-−–<>≤≥&|÷√^'"]/
/** Allowed first and last character of a stretch */
const START = /[A-Za-z\u00C0-\u024F\u0370-\u03FF0-9([√|−\-+\uE000-\uE0FF]/
const END = /[A-Za-z\u00C0-\u024F\u0370-\u03FF0-9)\]%²³'|\u0300-\u036F\uE000-\uE0FF]/

/** Drops a bracket at either end whose partner is not inside the stretch. */
function balance(s: string): string {
  let out = s
  for (let guard = 0; guard < 6; guard++) {
    const opens = (out.match(/[([]/g) ?? []).length
    const closes = (out.match(/[)\]]/g) ?? []).length
    if (opens > closes && /^[([]/.test(out)) out = out.slice(1).trimStart()
    else if (closes > opens && /[)\]]$/.test(out)) out = out.slice(0, -1).trimEnd()
    else break
  }
  return out
}

function isolateStretch(seg: string): string {
  // trim to the first and last character a stretch may start / end with
  let a = 0
  let b = seg.length
  while (a < b && !START.test(seg[a])) a++
  while (b > a && !END.test(seg[b - 1])) b--
  if (a >= b) return seg
  const core = balance(seg.slice(a, b))
  // a {placeholder} counts as a value: "({idx} = {n})" and "{a} – {b}" need the marks too
  if (!core || !(LETTER.test(core) || /[\uE000-\uE0FF]/.test(core)) || !NEUTRAL.test(core)) return seg
  const at = seg.indexOf(core, a)
  if (at < 0) return seg
  return seg.slice(0, at) + LRI + core + PDI + seg.slice(at + core.length)
}

/** Wraps every English stretch that holds brackets, commas, "=" and the like in LRI … PDI. */
export function isolateLatin(text: string): string {
  if (!text || !ARABIC.test(text) || HAS_MARKS.test(text)) return text
  // {n}-style placeholders are kept whole (they are filled in later)
  const holes: string[] = []
  const safe = text.replace(/\{[A-Za-z0-9_]+\}/g, (m) => String.fromCharCode(0xe000 + holes.push(m) - 1))
  // split into Arabic and non-Arabic stretches; only the latter are looked at
  let out = ''
  let seg = ''
  for (const ch of safe) {
    if (ARABIC.test(ch) || ch === '،' || ch === '؛') {
      if (seg) { out += isolateStretch(seg); seg = '' }
      out += ch
    } else seg += ch
  }
  if (seg) out += isolateStretch(seg)
  return out.replace(/[\uE000-\uE0FF]/g, (c) => holes[c.charCodeAt(0) - 0xe000] ?? c)
}

/** isolateLatin for Arabic pages, the text unchanged for English ones. */
export function bidiFor(lang: string, text: string): string {
  return lang === 'ar' ? isolateLatin(text) : text
}

/**
 * The same, applied to every string in an object (message files, page copy).
 * Functions that return text are wrapped too. Used for Arabic only.
 */
export function isolateLatinDeep<T>(value: T): T {
  if (typeof value === 'string') return isolateLatin(value) as T
  if (typeof value === 'function') {
    const fn = value as unknown as (...a: unknown[]) => unknown
    return ((...a: unknown[]) => isolateLatinDeep(fn(...a))) as T
  }
  if (Array.isArray(value)) return value.map((v) => isolateLatinDeep(v)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = isolateLatinDeep(v)
    return out as T
  }
  return value
}
