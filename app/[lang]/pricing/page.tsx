import { headers } from 'next/headers'
import { regionForCountry } from '@/lib/pricing'
import PricingClient from './PricingClient'

// Each visitor sees one price list, chosen from their country: Vercel adds
// the x-vercel-ip-country header to every request (absent locally, which
// falls back to the Egyptian list). There is no switch on the page.
export default async function Page() {
  const country = (await headers()).get('x-vercel-ip-country')
  return <PricingClient defaultRegion={regionForCountry(country)} />
}
