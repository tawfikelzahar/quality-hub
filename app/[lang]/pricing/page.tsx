import { headers } from 'next/headers'
import { regionForCountry } from '@/lib/pricing'
import PricingClient from './PricingClient'

// The price list shown first follows the visitor's country: Vercel adds the
// x-vercel-ip-country header to every request (absent locally, which falls
// back to the Egyptian list). Visitors can switch lists on the page.
export default async function Page() {
  const country = (await headers()).get('x-vercel-ip-country')
  return <PricingClient defaultRegion={regionForCountry(country)} />
}
