// ─────────────────────────────────────────────────────────────────────────
// Pro prices — the one place to change them (agreed 10 Nov 2026).
//
// Pro is paid once for a period; it never renews by itself (Paymob without a
// commercial register). Three price lists:
//   eg    Egypt, in Egyptian pounds
//   me    the six Gulf countries, also in Egyptian pounds (16 Nov 2026):
//         Paymob takes Gulf cards on this account in EGP only, so Gulf
//         prices are about the old dollar prices converted at ~53.8 EGP/USD
//         ($12.99 → 699, $9.99 → 549, $99 → 5,390, $79 → 4,290). Review them
//         if the dollar moves a lot.
//   intl  everyone else, in US dollars, shown only: checkout stays closed
//         until payments from other countries are possible (commercial
//         register needed, per Paymob)
// The pricing page shows one list only, picked from the visitor's country
// (Vercel's x-vercel-ip-country header, see app/[lang]/pricing/page.tsx).
// Visitors cannot switch lists. Checkout must pick the price the same way,
// on the server, never from a value sent by the browser.
//
// Founding price: shown while FOUNDING.open is true. It is limited by time
// only, never by a number of subscribers (decided 10 Nov 2026): everyone who
// pays before it closes gets it.
//
// LAUNCH DAY — the only thing to do (no code, no push):
//   Vercel → Settings → Environment Variables → Production → add
//     NEXT_PUBLIC_LAUNCH_DATE = 2026-12-01      (the launch day, YYYY-MM-DD)
//   then Deployments → latest → ⋯ → Redeploy.
// The founding price then closes at the end of launch day + FOUNDING.days
// (60) in Cairo time, summer time included. That turns on the countdown and
// the closing date on the pricing page, and closes the founding price
// everywhere (pricing page, home page badge, checkout) at that moment.
// Until the variable is set the founding price is open with no countdown.
// ─────────────────────────────────────────────────────────────────────────

export type Region = 'eg' | 'me' | 'intl'
export type PeriodId = 'monthly' | 'quarterly' | 'yearly'

export interface PlanPrice {
  id: PeriodId
  months: number
  /** regular price */
  price: number
  /** founding price (while FOUNDING.open, until FOUNDING.endsAt) */
  founding: number
}

export interface PriceList {
  currency: 'EGP' | 'USD'
  plans: PlanPrice[]
}

export const PRICES: Record<Region, PriceList> = {
  eg: {
    currency: 'EGP',
    plans: [
      { id: 'monthly', months: 1, price: 399, founding: 299 },
      { id: 'quarterly', months: 3, price: 999, founding: 799 },
      { id: 'yearly', months: 12, price: 3490, founding: 2490 },
    ],
  },
  me: {
    currency: 'EGP',
    plans: [
      { id: 'monthly', months: 1, price: 699, founding: 549 },
      { id: 'yearly', months: 12, price: 5390, founding: 4290 },
    ],
  },
  intl: {
    currency: 'USD',
    plans: [
      { id: 'monthly', months: 1, price: 12.99, founding: 9.99 },
      { id: 'yearly', months: 12, price: 99, founding: 79 },
    ],
  },
}

export const FOUNDING = {
  open: true,
  /** How long the founding price stays open after launch day (decided: 60 days). */
  days: 60,
  /** Launch day in Cairo, 'YYYY-MM-DD', from NEXT_PUBLIC_LAUNCH_DATE in Vercel; null until it is set. */
  launchDate: ((process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '').trim() || null) as string | null,
}

const CAIRO = 'Africa/Cairo'

/** Cairo's offset from UTC, in minutes, at an instant (+120 in winter, +180 in summer). */
function cairoOffsetMin(utcMs: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CAIRO, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]),
  )
  const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((asIfUtc - utcMs) / 60000)
}

/** 23:59:59 of a calendar day in Cairo, as a UTC instant in ms. */
export function cairoEndOfDay(year: number, month: number, day: number): number {
  const wall = Date.UTC(year, month - 1, day, 23, 59, 59)
  let utc = wall - cairoOffsetMin(wall) * 60000
  utc = wall - cairoOffsetMin(utc) * 60000 // second pass settles a summer-time change
  return utc
}

/** Launch day as [year, month, day], or null when it is not a real YYYY-MM-DD date. */
function readLaunchDate(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const check = new Date(Date.UTC(y, mo - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null
  return [y, mo, d]
}

/**
 * Closing moment in ms: end of (launch day + FOUNDING.days) in Cairo. Null
 * when no launch date is set, or when it cannot be read.
 */
export function foundingEndsAtMs(): number | null {
  if (!FOUNDING.launchDate) return null
  const ymd = readLaunchDate(FOUNDING.launchDate)
  if (!ymd) return null
  const last = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2] + FOUNDING.days))
  return cairoEndOfDay(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate())
}

/**
 * Is the founding price open to everyone right now? Open while no launch
 * date is set; a launch date that cannot be read closes it rather than
 * leaving it open forever (the pricing page shows it at once).
 */
export function foundingOpen(now: number = Date.now()): boolean {
  if (!FOUNDING.open) return false
  if (!FOUNDING.launchDate) return true
  const end = foundingEndsAtMs()
  return end !== null && now < end
}

/** The six Gulf countries (ISO codes, as in Vercel's x-vercel-ip-country). */
export const GULF_COUNTRIES = ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'] as const

/**
 * Egypt, or an unknown country (no header), gets the Egyptian list; the Gulf
 * the Gulf list (EGP); everyone else the dollar list (checkout closed).
 */
export function regionForCountry(country: string | null | undefined): Region {
  const cc = (country ?? '').trim().toUpperCase()
  if (cc === '' || cc === 'EG') return 'eg'
  return (GULF_COUNTRIES as readonly string[]).includes(cc) ? 'me' : 'intl'
}

/** Regions whose customers can pay now (Paymob, card in EGP). */
export function regionCanPay(region: Region): boolean {
  return region === 'eg' || region === 'me'
}

/** "EGP 2,490" / "2,490 ج.م" / "$9.99" */
export function formatPrice(amount: number, currency: PriceList['currency'], lang: 'en' | 'ar'): string {
  const n = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
  if (currency === 'USD') return `$${n}`
  return lang === 'ar' ? `${n} ج.م` : `EGP ${n}`
}

/** Percent saved against paying the monthly price every month (same price tier). */
export function savingPercent(list: PriceList, plan: PlanPrice, founding: boolean): number {
  const monthly = list.plans.find((p) => p.id === 'monthly')
  if (!monthly || plan.months <= 1) return 0
  const pick = (p: PlanPrice) => (founding ? p.founding : p.price)
  const full = pick(monthly) * plan.months
  return Math.round((1 - pick(plan) / full) * 100)
}
