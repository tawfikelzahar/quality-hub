// ─────────────────────────────────────────────────────────────────────────
// Pro prices — the one place to change them (agreed 10 Nov 2026).
//
// Pro is paid once for a period; it never renews by itself (Paymob without a
// commercial register). Two price lists:
//   eg  Egypt, in Egyptian pounds
//   me  Gulf and the rest of the Middle East, in US dollars
// The pricing page picks the list from the visitor's country (Vercel's
// x-vercel-ip-country header, see app/[lang]/pricing/page.tsx) and the
// visitor can switch it.
//
// Founding price: shown while FOUNDING.open is true. It is limited by time
// only, never by a number of subscribers (decided 10 Nov 2026): everyone who
// pays before FOUNDING.endsAt gets it. endsAt stays null until the launch
// date is set; when set, the pricing page shows the date.
// ─────────────────────────────────────────────────────────────────────────

export type Region = 'eg' | 'me'
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
    currency: 'USD',
    plans: [
      { id: 'monthly', months: 1, price: 12.99, founding: 9.99 },
      { id: 'yearly', months: 12, price: 99, founding: 79 },
    ],
  },
}

export const FOUNDING = {
  open: true,
  /** ISO date the founding price closes, or null while the launch date is not set */
  endsAt: null as string | null,
}

/** Egypt, or an unknown country (no header), gets the Egyptian list; everyone else the dollar list. */
export function regionForCountry(country: string | null | undefined): Region {
  const cc = (country ?? '').trim().toUpperCase()
  return cc === '' || cc === 'EG' ? 'eg' : 'me'
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
