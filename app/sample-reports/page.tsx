'use client'

import { useState } from 'react'
import Link from 'next/link'
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'
import { SAMPLE_REPORTS, SAMPLE_PDF_BUILDERS, SAMPLE_EXCEL_BUILDERS, type SampleToolId } from '@/lib/sampleReports'

// ─────────────────────────────────────────────────────────────────────────
// Public, no-login-required page: lets a visitor download a REAL PDF and
// REAL Excel report — built with the exact same lib/pdf/reportDesign.ts
// and lib/excelReport.ts systems every tool's own Export button uses —
// so they can judge report quality before creating an account or
// subscribing. Data is realistic and internally consistent (see
// lib/sampleReports.ts) but illustrative, not a live analysis.
// ─────────────────────────────────────────────────────────────────────────

export default function SampleReportsPage() {
  const [theme, setTheme] = usePersistedTheme()
  const { t } = useLanguage()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const dark = theme === 'dark'

  const [pdfLoading, setPdfLoading] = useState<SampleToolId | null>(null)
  const [excelLoading, setExcelLoading] = useState<SampleToolId | null>(null)

  const bodyColor = dark ? 'rgba(226,232,240,0.82)' : 'rgba(30,41,59,0.82)'

  const handlePdf = (id: SampleToolId) => {
    setPdfLoading(id)
    // Give the button's own state update a frame to paint before the
    // (synchronous, CPU-bound) jsPDF generation blocks the main thread.
    setTimeout(() => {
      try {
        SAMPLE_PDF_BUILDERS[id]()
      } finally {
        setPdfLoading(null)
      }
    }, 30)
  }

  const handleExcel = async (id: SampleToolId) => {
    setExcelLoading(id)
    try {
      await SAMPLE_EXCEL_BUILDERS[id]()
    } finally {
      setExcelLoading(null)
    }
  }

  const cardStyle: React.CSSProperties = {
    ...s.card,
    padding: 26,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  }

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13.5,
    fontWeight: 700,
    borderRadius: 8,
    padding: '11px 16px',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
  }

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: dark ? 'linear-gradient(135deg,#0FD4C8,#00A896)' : 'linear-gradient(135deg,#0e7474,#00a896)',
    color: '#06121a',
  }

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: 'transparent',
    color: c.text,
    border: `1px solid ${c.border}`,
  }

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_sample_reports" />

      <main className="qh-main" style={{ ...s.main, alignItems: 'center' }}>
        <div style={{ maxWidth: 880, width: '100%', marginTop: 20 }}>
          {/* ── Hero ── */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: c.accent,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                marginBottom: 12,
              }}
            >
              {t('sample_kicker')}
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: c.text, margin: 0, lineHeight: 1.28, letterSpacing: -0.5 }}>
              {t('sample_hero_title_1')}
              <br />
              {t('sample_hero_title_2')}
            </h1>
            <p style={{ fontSize: 15, color: bodyColor, lineHeight: 1.75, maxWidth: 640, margin: '18px auto 0' }}>
              {t('sample_hero_sub')}
            </p>
          </div>

          {/* ── Report cards ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 18,
              marginBottom: 28,
            }}
          >
            {SAMPLE_REPORTS.map((report) => (
              <div key={report.id} style={cardStyle}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: c.text, margin: '0 0 8px' }}>
                    {t(report.nameKey as Parameters<typeof t>[0])}
                  </h2>
                  <p style={{ fontSize: 13.5, color: bodyColor, lineHeight: 1.65, margin: 0 }}>
                    {t(report.descKey as Parameters<typeof t>[0])}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                  <button
                    style={{ ...btnPrimary, opacity: pdfLoading === report.id ? 0.7 : 1 }}
                    onClick={() => handlePdf(report.id)}
                    disabled={pdfLoading === report.id}
                  >
                    {pdfLoading === report.id ? '...' : `📄 ${t('sample_download_pdf')}`}
                  </button>
                  <button
                    style={{ ...btnSecondary, opacity: excelLoading === report.id ? 0.7 : 1 }}
                    onClick={() => handleExcel(report.id)}
                    disabled={excelLoading === report.id}
                  >
                    {excelLoading === report.id ? '...' : `📊 ${t('sample_download_excel')}`}
                  </button>
                </div>

                <Link
                  href={report.href}
                  style={{ fontSize: 12.5, color: c.accent, textDecoration: 'none', fontWeight: 600, textAlign: 'center', marginTop: 2 }}
                >
                  {report.href} →
                </Link>
              </div>
            ))}
          </div>

          {/* ── Note ── */}
          <div
            style={{
              background: dark ? 'rgba(15,212,200,0.06)' : '#f0faf9',
              border: `1px solid ${dark ? 'rgba(15,212,200,0.18)' : '#cdeee9'}`,
              borderRadius: 10,
              padding: '14px 18px',
              fontSize: 13,
              color: bodyColor,
              lineHeight: 1.65,
              marginBottom: 40,
            }}
          >
            ℹ️ {t('sample_note')}
          </div>

          {/* ── CTA ── */}
          <div style={{ ...s.card, textAlign: 'center', padding: '32px 24px', marginBottom: 40 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: c.text, margin: '0 0 8px' }}>
              {t('sample_cta_title')}
            </h2>
            <p style={{ fontSize: 14, color: bodyColor, margin: '0 0 20px', lineHeight: 1.6 }}>
              {t('sample_cta_sub')}
            </p>
            <Link
              href="/pricing"
              style={{
                display: 'inline-block',
                background: dark ? 'linear-gradient(135deg,#0FD4C8,#00A896)' : 'linear-gradient(135deg,#0e7474,#00a896)',
                color: '#06121a',
                fontWeight: 700,
                fontSize: 14,
                padding: '12px 28px',
                borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              {t('sample_cta_button')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
