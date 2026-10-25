'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { GA_MEASUREMENT_ID, gaEnabledHere, track } from '@/lib/analytics'

// ─────────────────────────────────────────────────────────────────────────
// Loads GA4 on the live site only (see GA_HOSTS in lib/analytics.ts),
// marks the owner's browsers as internal traffic (open any page once with
// ?qh_internal=1; ?qh_internal=0 undoes it) and
// reports sign-ins that come back through /auth/callback, which adds
// ?qh_auth=sign_up|login&qh_m=google|email to the page it returns to.
// ─────────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [enabled, setEnabled] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the host is only known in the browser
  useEffect(() => { setEnabled(gaEnabledHere()) }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    // ?qh_internal=1 marks this browser as the owner's (stays until ?qh_internal=0)
    const internal = url.searchParams.get('qh_internal')
    if (internal === '1' || internal === '0') {
      try {
        if (internal === '1') localStorage.setItem('qh-internal', '1')
        else localStorage.removeItem('qh-internal')
      } catch {}
      url.searchParams.delete('qh_internal')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
      window.alert(internal === '1' ? 'This browser is now excluded from Google Analytics reports.' : 'This browser is counted in Google Analytics again.')
    }
    const auth = url.searchParams.get('qh_auth')
    if (auth !== 'sign_up' && auth !== 'login') return
    const method = url.searchParams.get('qh_m') === 'email' ? 'email' : 'google'
    url.searchParams.delete('qh_auth')
    url.searchParams.delete('qh_m')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    // wait a moment so gtag.js is ready when GA is on
    const id = window.setTimeout(() => track(auth, { method }), 1500)
    return () => window.clearTimeout(id)
  }, [])

  // First page view once the saved language is applied to <html lang>, so
  // Arabic visitors are counted as Arabic from their first page.
  useEffect(() => {
    if (!enabled) return
    const id = window.setTimeout(() => {
      const w = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
      w.dataLayer = w.dataLayer || []
      // same queue stub gtag.js expects; commands wait here until it loads
      // eslint-disable-next-line prefer-rest-params
      w.gtag = w.gtag || function gtag() { w.dataLayer!.push(arguments) }
      w.gtag('js', new Date())
      w.gtag('set', 'user_properties', { ui_lang: document.documentElement.lang === 'ar' ? 'ar' : 'en' })
      let internalVisit = false
      try { internalVisit = localStorage.getItem('qh-internal') === '1' } catch {}
      // traffic_type "internal" is what GA's Internal Traffic data filter removes
      w.gtag('config', GA_MEASUREMENT_ID, internalVisit ? { traffic_type: 'internal' } : {})
    }, 400)
    return () => window.clearTimeout(id)
  }, [enabled])

  if (!enabled) return null
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
}
