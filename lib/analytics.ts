// ─────────────────────────────────────────────────────────────────────────
// Google Analytics (GA4) — one place for the measurement ID, where it loads,
// and every custom event the site sends.
//
// GA loads only on the live site (GA_HOSTS), never on Vercel preview links
// or localhost, so test visits don't mix into the real numbers.
//
// Every event carries:
//   tool_name  the page path without the slash ("spc", "gage-rr", "home")
//   ui_lang    "ar" or "en", the language the visitor is reading
//
// Events (register tool_name, ui_lang, feature, file_format, method,
// channel and search_term as event-scoped custom dimensions in GA Admin):
//   tool_calculate   first result after the visitor typed, pasted or uploaded data (once per page view)
//   example_loaded   "Try an example" pressed
//   file_export      an allowed export was started (file_format: csv | png | excel | pdf)
//   save_project     a project was saved (Pro)
//   sign_up / login  account created / signed in (method: google | email)
//   get_pro_click    a Get Pro button was pressed
//   menu_open        the phone menu was opened
//   search           a tool search was used (search_term)
//   signup_wall_hit / pro_wall_hit   (lib/exportGate.ts) a locked feature was pressed
//   contact_open     the floating contact button was opened (components/ContactWidget.tsx)
//   contact_click    a contact choice was pressed (channel: billing | problem | suggest | email | linkedin)
//
// In development, or with localStorage "qh-ga-debug" = "1", events are also
// printed to the browser console as [ga] … so they can be checked by hand.
// ─────────────────────────────────────────────────────────────────────────

import { SITE } from '@/lib/site'

export const GA_MEASUREMENT_ID = 'G-9RKQ89NGD0'

/** Hosts where GA runs: the configured live URL plus the brand domain. */
export const GA_HOSTS: string[] = Array.from(new Set([
  new URL(SITE.url).hostname,
  SITE.domain,
  `www.${SITE.domain}`,
]))

export function gaEnabledHere(): boolean {
  return typeof window !== 'undefined' && GA_HOSTS.includes(window.location.hostname)
}

function debugOn(): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  try { return localStorage.getItem('qh-ga-debug') === '1' } catch { return false }
}

/** "spc", "gage-rr", "home" … from the current path */
export function toolNameFromPath(path?: string): string {
  const p = (path ?? (typeof window !== 'undefined' ? window.location.pathname : '/')).replace(/^\/+|\/+$/g, '')
  return p.split('/')[0] || 'home'
}

function uiLang(): string {
  if (typeof document === 'undefined') return 'en'
  return document.documentElement.lang === 'ar' ? 'ar' : 'en'
}

export type GaEvent =
  | 'tool_calculate' | 'example_loaded' | 'file_export' | 'save_project'
  | 'sign_up' | 'login' | 'get_pro_click' | 'menu_open' | 'search'
  | 'signup_wall_hit' | 'pro_wall_hit'
  | 'contact_open' | 'contact_click'

export function track(event: GaEvent, params: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === 'undefined') return
  const payload = { tool_name: toolNameFromPath(), ui_lang: uiLang(), ...params }
  if (debugOn()) console.info('[ga]', event, payload)
  const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag === 'function') gtag('event', event, payload)
}

/** Keeps the ui_lang user property in step with the language toggle. */
export function setLanguageProperty(lang: string) {
  if (typeof window === 'undefined') return
  const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag === 'function') gtag('set', 'user_properties', { ui_lang: lang === 'ar' ? 'ar' : 'en' })
}
