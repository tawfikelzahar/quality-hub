// ─────────────────────────────────────────────────────────────────────────
// Client branding for exported reports (Pro).
//
// A Pro user saves "Prepared by", job title, company and a company logo on
// the Account page (table report_branding + bucket company-logos, see
// supabase/sql/007_report_branding.sql). ReportBrandingLoader (mounted in
// the root layout) loads it once per session and keeps it here, so the
// synchronous PDF/Excel builders can read it without any await:
//   • PDF: company logo (or name) in the header, "Prepared by" line under
//     the title, signature block at the end, Mizan only in the footer
//   • Excel: company in the title band, "Prepared by" row, logo top-right
// When nothing is set (free users, or Pro without branding) reports keep
// the standard Mizan header.
// ─────────────────────────────────────────────────────────────────────────

export interface ReportBranding {
  preparedBy: string
  jobTitle: string
  company: string
  /** company logo as a PNG/JPEG data URL, ready for jsPDF / ExcelJS */
  logoDataUrl: string | null
  /** natural size of the logo, for aspect-correct placement */
  logoWidth: number
  logoHeight: number
  /** "Prepared by" signature line at the end of the PDF */
  signPrepared: boolean
  /** "Approved by" signature line at the end of the PDF */
  signApproved: boolean
}

let current: ReportBranding | null = null

/** Branding used by the next report, or null for the standard header. */
export function getReportBranding(): ReportBranding | null {
  if (!current) return null
  const hasAny = current.preparedBy.trim() || current.company.trim() || current.logoDataUrl
  return hasAny ? current : null
}

export function setReportBranding(b: ReportBranding | null) {
  current = b
}

/** "Name · Job title" (whatever is filled in). */
export function preparedByLine(b: ReportBranding): string {
  return [b.preparedBy.trim(), b.jobTitle.trim()].filter(Boolean).join(' · ')
}

/** Reads an image URL (or File) into a data URL plus its natural size. */
export async function imageToDataUrl(src: string | Blob): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const blob = typeof src === 'string' ? await (await fetch(src, { cache: 'no-store' })).blob() : src
    if (!/^image\/(png|jpeg)$/.test(blob.type)) return null
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
    const size: { width: number; height: number } = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('logo did not load'))
      img.src = dataUrl
    })
    return { dataUrl, ...size }
  } catch {
    return null
  }
}

/** Fit a w×h image inside maxW×maxH, keeping its aspect ratio. */
export function fitBox(w: number, h: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / w, maxH / h)
  return { w: w * s, h: h * s }
}
