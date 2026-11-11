// ─────────────────────────────────────────────────────────────────────────
// The greeting at the top of every email (welcome, payment, renewal): the
// Arabic line first, the English line under it, like the rest of each email.
//
// The name goes into BOTH lines, each wrapped in <bdi> (an isolated piece of
// text), so an English name inside the Arabic line, or an Arabic name inside
// the English line, keeps its own direction and does not move the words or
// punctuation around it. Without a name the greeting is just the word.
//
// Relative imports only: the golden tests load this file without the @ alias.
// ─────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
}

export interface Greeting {
  /** Arabic line; n is the name already isolated for HTML (or '' when there is no name) */
  ar: (n: string) => string
  /** English line */
  en: (n: string) => string
  /** shown once, at the end of the Arabic line */
  emoji?: string
}

export const GREETINGS = {
  welcome: {
    ar: (n) => (n ? `مرحبًا ${n}` : 'مرحبًا'),
    en: (n) => (n ? `Hello ${n},` : 'Hello,'),
    emoji: '👋',
  },
  payment: {
    ar: (n) => (n ? `شكرًا ${n}` : 'شكرًا لك'),
    en: (n) => (n ? `Thank you, ${n}` : 'Thank you'),
    emoji: '🎉',
  },
  renewal: {
    ar: (n) => (n ? `مرحبًا ${n}،` : 'مرحبًا،'),
    en: (n) => (n ? `Hello ${n},` : 'Hello,'),
  },
} satisfies Record<string, Greeting>

/** The two greeting lines as HTML (an h1 for Arabic, a small line for English under it). */
export function greetingHtml(g: Greeting, name: string): string {
  const n = name.trim() ? `<bdi>${esc(name.trim())}</bdi>` : ''
  const ar = `${g.ar(n)}${g.emoji ? ` ${g.emoji}` : ''}`
  return `<h1 style="margin:0 0 4px;font-size:20px;line-height:1.5;color:#0B1F3F;">${ar}</h1>
<p dir="ltr" style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#6B7280;text-align:right;font-family:Arial,Helvetica,sans-serif;">${g.en(n)}</p>`
}

/** The same two lines for the plain-text version of the email. */
export function greetingText(g: Greeting, name: string): string[] {
  const n = name.trim()
  return [`${g.ar(n)}${g.emoji ? ` ${g.emoji}` : ''}`, g.en(n)]
}
