'use client'

import { createClient } from '@/lib/supabase'
import { imageToDataUrl, setReportBranding, type ReportBranding } from '@/lib/reportBranding'

export const LOGO_BUCKET = 'company-logos'

export interface BrandingRow {
  prepared_by: string | null
  job_title: string | null
  company: string | null
  logo_path: string | null
  show_signatures: boolean | null
}

/** Public URL of a stored logo (bucket is public-read). */
export function logoPublicUrl(path: string | null): string | null {
  if (!path) return null
  const supabase = createClient()
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Turns a saved row into the in-memory branding the report builders read. */
export async function brandingFromRow(row: BrandingRow | null): Promise<ReportBranding | null> {
  if (!row) return null
  const url = logoPublicUrl(row.logo_path)
  const img = url ? await imageToDataUrl(url) : null
  return {
    preparedBy: row.prepared_by ?? '',
    jobTitle: row.job_title ?? '',
    company: row.company ?? '',
    logoDataUrl: img?.dataUrl ?? null,
    logoWidth: img?.width ?? 0,
    logoHeight: img?.height ?? 0,
    showSignatures: row.show_signatures ?? true,
  }
}

/**
 * Loads the signed-in user's branding into the report builders. Applied for
 * Pro users only — free users get the standard header (their PDF/Excel
 * exports are Pro-gated anyway). Safe to call repeatedly.
 */
export async function refreshReportBranding(): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setReportBranding(null); return }
    const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
    if (profile?.subscription_status !== 'pro') { setReportBranding(null); return }
    const { data: row } = await supabase
      .from('report_branding')
      .select('prepared_by, job_title, company, logo_path, show_signatures')
      .eq('user_id', user.id)
      .maybeSingle()
    setReportBranding(await brandingFromRow(row as BrandingRow | null))
  } catch {
    setReportBranding(null) // never block an export because branding failed to load
  }
}
