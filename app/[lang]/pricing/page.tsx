import { headers } from 'next/headers'
import { regionForCountry } from '@/lib/pricing'
import { visitorCountry } from '@/lib/payments.server'
import { createServerSupabase } from '@/lib/supabase-server'
import PricingClient from './PricingClient'

// Each visitor sees one price list, chosen from their country: Vercel adds
// the x-vercel-ip-country header to every request (absent locally, which
// falls back to the Egyptian list). There is no switch on the page.
// The admin can add ?as=SA (any two-letter country) to see that country's
// list from Egypt; it is ignored for everyone else.
export default async function Page({ searchParams }: { searchParams: Promise<{ as?: string | string[] }> }) {
  const { as } = await searchParams
  const header = (await headers()).get('x-vercel-ip-country')
  const country = typeof as === 'string' && as ? await visitorCountry(header, as, await createServerSupabase()) : header
  const preview = country !== header ? country ?? '' : ''
  return <PricingClient defaultRegion={regionForCountry(country)} asCountry={preview} />
}
