'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { refreshReportBranding } from '@/lib/reportBrandingLoad'

/** Loads the Pro user's report branding once per session and on sign-in/out. */
export default function ReportBrandingLoader() {
  useEffect(() => {
    refreshReportBranding()
    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange(() => { refreshReportBranding() })
    return () => data.subscription.unsubscribe()
  }, [])
  return null
}
