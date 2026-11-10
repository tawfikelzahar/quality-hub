import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createServerSupabase } from '@/lib/supabase-server'
import { checkoutContext, foundingOpen, userGetsFounding } from '@/lib/payments.server'
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

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const { plan } = await searchParams
  const country = (await headers()).get('x-vercel-ip-country')
  const supabase = await createServerSupabase()
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
    />
  )
}
