'use client'

// Account → "Your reports" (Pro): Prepared by, job title, company, company
// logo and sign-off block, applied to every PDF/Excel export. Free users see
// what it does and that it comes with Pro. See lib/reportBranding.ts.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { COLORS, getSharedStyles, type ThemeMode } from '@/lib/theme'
import { useLanguage } from '@/lib/i18n/context'
import { useSubscription } from '@/lib/useSubscription'
import { getReportBranding, imageToDataUrl, setReportBranding, type ReportBranding } from '@/lib/reportBranding'
import { LOGO_BUCKET, logoPublicUrl, refreshReportBranding, type BrandingRow } from '@/lib/reportBrandingLoad'
import { buildGageRRSamplePdf } from '@/lib/sampleReports'

const MAX_LOGO_BYTES = 512 * 1024

/** `previewPro` renders the Pro form without a subscription check (design previews only). */
export default function ReportBrandingSettings({ theme, previewPro = false }: { theme: ThemeMode; previewPro?: boolean }) {
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const { t } = useLanguage()
  const sub = useSubscription()
  const isPro = previewPro || sub.isPro
  const subLoading = previewPro ? false : sub.loading

  const [preparedBy, setPreparedBy] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [showSignatures, setShowSignatures] = useState(true)
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isPro) return
    let active = true
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('report_branding')
        .select('prepared_by, job_title, company, logo_path, show_signatures')
        .eq('user_id', user.id)
        .maybeSingle()
      const row = data as BrandingRow | null
      if (!active) return
      const fallbackName = (user.user_metadata?.full_name as string | undefined) ?? ''
      setPreparedBy(row?.prepared_by ?? fallbackName)
      setJobTitle(row?.job_title ?? '')
      setCompany(row?.company ?? '')
      setShowSignatures(row?.show_signatures ?? true)
      setLogoPath(row?.logo_path ?? null)
      setLogoPreview(logoPublicUrl(row?.logo_path ?? null))
    })()
    return () => { active = false }
  }, [isPro])

  const pickLogo = (f: File | undefined) => {
    setMessage(null)
    if (!f) return
    if (!/^image\/(png|jpeg)$/.test(f.type)) { setMessage({ ok: false, text: t('rb_err_type') }); return }
    if (f.size > MAX_LOGO_BYTES) { setMessage({ ok: false, text: t('rb_err_size') }); return }
    setLogoFile(f)
    setRemoveLogo(false)
    setLogoPreview(URL.createObjectURL(f))
  }

  /** Branding object from what is on screen now (used for the sample PDF). */
  const currentBranding = async (): Promise<ReportBranding> => {
    const img = logoFile ? await imageToDataUrl(logoFile) : !removeLogo && logoPreview ? await imageToDataUrl(logoPreview) : null
    return {
      preparedBy, jobTitle, company,
      logoDataUrl: img?.dataUrl ?? null, logoWidth: img?.width ?? 0, logoHeight: img?.height ?? 0,
      showSignatures,
    }
  }

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t('rb_err_signin'))
      let path = removeLogo ? null : logoPath
      if (logoFile) {
        const ext = logoFile.type === 'image/png' ? 'png' : 'jpg'
        const newPath = `${user.id}/logo-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from(LOGO_BUCKET).upload(newPath, logoFile, { upsert: true, contentType: logoFile.type })
        if (upErr) throw upErr
        path = newPath
      }
      if (logoPath && logoPath !== path) await supabase.storage.from(LOGO_BUCKET).remove([logoPath])
      const { error } = await supabase.from('report_branding').upsert({
        user_id: user.id,
        prepared_by: preparedBy.trim() || null,
        job_title: jobTitle.trim() || null,
        company: company.trim() || null,
        logo_path: path,
        show_signatures: showSignatures,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setLogoPath(path)
      setLogoFile(null)
      setRemoveLogo(false)
      await refreshReportBranding()
      setMessage({ ok: true, text: t('rb_saved') })
    } catch (e) {
      setMessage({ ok: false, text: `${t('rb_err_save')} ${(e as Error).message ?? ''}`.trim() })
    } finally {
      setBusy(false)
    }
  }

  const downloadSample = async () => {
    const saved = getReportBranding()
    setReportBranding(await currentBranding())
    try { buildGageRRSamplePdf() } finally { setReportBranding(saved) }
  }

  const input = { ...s.input, width: '100%' }
  const label = { fontSize: 12, fontWeight: 600, color: c.muted, marginBottom: 6, display: 'block' } as const

  return (
    <div style={{ ...s.card, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={s.sectionTitle}>{t('rb_title')}</div>
        <span style={{ ...s.badge, background: c.gold, color: c.onGold }}>PRO</span>
      </div>
      <p style={{ fontSize: 13, color: c.muted, margin: '0 0 16px', lineHeight: 1.7 }}>{t('rb_intro')}</p>

      {subLoading ? null : !isPro ? (
        <div style={{ border: `1px dashed ${c.border}`, borderRadius: 10, padding: 16 }}>
          <ul style={{ margin: '0 0 14px', paddingInlineStart: 18, fontSize: 13, color: c.text, lineHeight: 1.9 }}>
            <li>{t('rb_free_b1')}</li>
            <li>{t('rb_free_b2')}</li>
            <li>{t('rb_free_b3')}</li>
          </ul>
          <Link href="/pricing" style={{ ...s.proBtn, display: 'inline-block' }}>{t('rb_free_cta')}</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <label><span style={label}>{t('rb_prepared_by')}</span>
              <input id="rb-prepared-by" style={input} value={preparedBy} maxLength={80} onChange={e => setPreparedBy(e.target.value)} placeholder={t('rb_prepared_by_ph')} /></label>
            <label><span style={label}>{t('rb_job_title')}</span>
              <input id="rb-job-title" style={input} value={jobTitle} maxLength={80} onChange={e => setJobTitle(e.target.value)} placeholder={t('rb_job_title_ph')} /></label>
          </div>
          <label><span style={label}>{t('rb_company')}</span>
            <input id="rb-company" style={input} value={company} maxLength={100} onChange={e => setCompany(e.target.value)} placeholder={t('rb_company_ph')} /></label>

          <div>
            <span style={label}>{t('rb_logo')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 160, height: 56, borderRadius: 8, border: `1px solid ${c.border}`, background: '#FFFFFF', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                {logoPreview && !removeLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoPreview} alt={t('rb_logo')} style={{ maxWidth: '92%', maxHeight: '80%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 11, color: '#8A98AF' }}>{t('rb_logo_none')}</span>}
              </div>
              <input ref={fileRef} id="rb-logo" type="file" accept="image/png,image/jpeg" hidden onChange={e => pickLogo(e.target.files?.[0])} />
              <button type="button" style={s.exportBtn} onClick={() => fileRef.current?.click()}>{t('rb_logo_upload')}</button>
              {logoPreview && !removeLogo && (
                <button type="button" style={{ ...s.exportBtn, color: c.danger }} onClick={() => { setRemoveLogo(true); setLogoFile(null) }}>{t('rb_logo_remove')}</button>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: c.muted, marginTop: 6 }}>{t('rb_logo_hint')}</div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: c.text, cursor: 'pointer' }}>
            <input id="rb-signatures" type="checkbox" checked={showSignatures} onChange={e => setShowSignatures(e.target.checked)} />
            {t('rb_signatures')}
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={{ ...s.ctaBtn, border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={save}>
              {busy ? t('rb_saving') : t('rb_save')}
            </button>
            <button type="button" style={s.exportBtn} onClick={downloadSample}>{t('rb_sample')}</button>
          </div>
          {message && (
            <div style={{ fontSize: 12.5, color: message.ok ? c.good : c.danger }}>{message.text}</div>
          )}
        </div>
      )}
    </div>
  )
}
