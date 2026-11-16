import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createServerSupabase } from '@/lib/supabase-server'
import { checkoutContext, foundingOpen, userGetsFounding, visitorCountry } from '@/lib/payments.server'
import CheckoutClient from './CheckoutClient'

// /checkout — order summary before paying for Pro. Anyone can read it; paying
// needs an account. The price list, whether checkout is open and the
// founding price are decided here on the server (lib/payments.server.ts)
// and checked again by /api/paymob/checkout.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return { title: lang === 'ar' ? 'إتمام الاشتراك' : 'Checkout', robots: { index: false, follow: false } }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string | string[]; as?: string | string[] }> }) {
  const { plan, as } = await searchParams
  const supabase = await createServerSupabase()
  // ?as=SA: the admin sees another country's prices and checkout (lib/payments.server.ts)
  const country = await visitorCountry((await headers()).get('x-vercel-ip-country'), as, supabase)
  const { data: { user } } = await supabase.auth.getUser()
  const ctx = await checkoutContext(country, supabase)
  const founding = user ? await userGetsFounding(supabase, user.id) : foundingOpen()
  return (
    <CheckoutClient
      region={ctx.region}
      state={ctx.state}
      testMode={ctx.state === 'open' && ctx.mode === 'test'}
      founding={founding}
      initialPlan={typeof plan === 'string' ? plan : ''}
      asCountry={typeof as === 'string' ? as : ''}
    />
  )
}
