'use client'

import { useEffect } from 'react'
import { onAuthStateChanged } from '@/lib/authState'
import { refreshReportBranding } from '@/lib/reportBrandingLoad'

/** Loads the Pro user's report branding once per page and again when the signed-in user or plan changes. */
export default function ReportBrandingLoader() {
  // Fires when the shared auth read (lib/authState.ts) finishes with someone
  // signed in, and on every later change of user or plan.
  useEffect(() => onAuthStateChanged(() => { refreshReportBranding() }), [])
  return null
}
