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
// pays before FOUNDING.endsAt gets it. endsAt stays null until the launch
// date is set; when set, the pricing page shows the date.
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
  /**
   * When the founding price closes, or null while the launch date is not set.
   * Launch day: set it to launch + 60 days, end of that day in Cairo, written
   * with the +02:00 offset, e.g. '2027-03-01T23:59:59+02:00'. That one line
   * turns on the countdown on the pricing page and closes the founding price
   * everywhere (pricing page, home page badge, checkout) at that moment.
   */
  endsAt: null as string | null,
}

/** Closing moment in ms, or null when no end date is set (or it cannot be read). */
export function foundingEndsAtMs(): number | null {
  if (!FOUNDING.endsAt) return null
  const end = Date.parse(FOUNDING.endsAt)
  return Number.isFinite(end) ? end : null
}

/** Is the founding price open to everyone right now? */
export function foundingOpen(now: number = Date.now()): boolean {
  if (!FOUNDING.open) return false
  if (!FOUNDING.endsAt) return true
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
