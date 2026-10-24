'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePersistedTheme } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'
import GetProLink from '@/components/GetProLink'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/lib/i18n/context'
import { TOOL_GROUPS, TOOL_COUNT, LANDING_COLUMN_ORDER } from '@/lib/tools'
import { SITE } from '@/lib/site'

// ─────────────────────────────────────────────────────────────────────────
// Landing page (Mizan design): hero with a live example, why, three steps,
// tools grouped by the question an engineer is asking, pricing teaser.
// Colours come only from the theme CSS variables (--qh-*), so light and
// dark both work; layout is mobile-first with the .mz-* classes below.
// ─────────────────────────────────────────────────────────────────────────

// ── Example in the hero: golden dataset DS01 (15 readings, LSL 23, USL 25).
// Computed here, not typed in, so the numbers on the page are always the
// real I-MR result (mean 24.167, σ within 0.310, Cpk 0.90, Ppk 1.08).
const EX = [24.1, 24.3, 23.9, 24.2, 24.6, 24.0, 23.8, 24.4, 24.5, 24.1, 24.0, 24.3, 23.7, 24.2, 24.4]
const EX_LSL = 23.0
const EX_USL = 25.0
const D2_N2 = 1.128
const exMean = EX.reduce((a, b) => a + b, 0) / EX.length
const exMRbar = EX.slice(1).reduce((s, v, i) => s + Math.abs(v - EX[i]), 0) / (EX.length - 1)
const exSigmaWithin = exMRbar / D2_N2
const exSigmaOverall = Math.sqrt(EX.reduce((s, v) => s + (v - exMean) ** 2, 0) / (EX.length - 1))
const exUCL = exMean + 3 * exSigmaWithin
const exLCL = exMean - 3 * exSigmaWithin
const exCpk = Math.min(EX_USL - exMean, exMean - EX_LSL) / (3 * exSigmaWithin)
const exPpk = Math.min(EX_USL - exMean, exMean - EX_LSL) / (3 * exSigmaOverall)


const STANDARDS = ['ISO 2859-1', 'AIAG MSA 4th ed.', 'Montgomery SPC', 'ICH Q1E', 'ICMSF']

// ── Small inline icons (stroke = currentColor, decorative) ──
const Arrow = () => (
  <svg className="mz-flip" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
)
const IconReport = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 17c1.5-2 2.5-2 3.5 0s2 2 3.5 0" /></svg>
)
const IconScreen = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
)
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
)
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
)
const IconAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>
)
const IconChevron = () => (
  <svg className="mz-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
)

/** I chart of the example, drawn with theme colours so it follows light/dark */
function ExampleChart({ label }: { label: string }) {
  const W = 360, H = 130
  const lo = exLCL - 0.15, hi = exUCL + 0.15
  const x = (i: number) => (i * W) / (EX.length - 1)
  const y = (v: number) => ((hi - v) / (hi - lo)) * H
  const pts = EX.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`-34 -6 ${W + 44} ${H + 12}`} style={{ width: '100%', height: 'auto', display: 'block', direction: 'ltr' }} role="img" aria-label={label}>
      <line x1="0" x2={W} y1={y(exUCL)} y2={y(exUCL)} stroke="var(--qh-danger)" strokeWidth="1" strokeDasharray="5 4" />
      <line x1="0" x2={W} y1={y(exMean)} y2={y(exMean)} stroke="var(--qh-good)" strokeWidth="1" />
      <line x1="0" x2={W} y1={y(exLCL)} y2={y(exLCL)} stroke="var(--qh-danger)" strokeWidth="1" strokeDasharray="5 4" />
      <g fill="var(--qh-muted)" fontSize="10" textAnchor="end" fontFamily="ui-monospace, monospace">
        <text x="-6" y={y(exUCL) + 3.5}>UCL</text>
        <text x="-6" y={y(exMean) + 3.5}>X̄</text>
        <text x="-6" y={y(exLCL) + 3.5}>LCL</text>
      </g>
      <polyline fill="none" stroke="var(--qh-data)" strokeWidth="2" strokeLinejoin="round" points={pts} />
      <g fill="var(--qh-data)">
        {EX.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" />)}
      </g>
    </svg>
  )
}

/** true on phone widths — tool groups start collapsed there */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return narrow
}

/** How many columns the tools section shows (matches the .mz-groups media queries). */
function useToolColumns(): 1 | 2 | 3 {
  const [cols, setCols] = useState<1 | 2 | 3>(3)
  useEffect(() => {
    const one = window.matchMedia('(max-width: 720px)')
    const two = window.matchMedia('(max-width: 1100px)')
    const update = () => setCols(one.matches ? 1 : two.matches ? 2 : 3)
    update()
    one.addEventListener('change', update)
    two.addEventListener('change', update)
    return () => { one.removeEventListener('change', update); two.removeEventListener('change', update) }
  }, [])
  return cols
}

export default function Home() {
  const [theme, setTheme] = usePersistedTheme()
  const dark = theme === 'dark'
  const { t, lang } = useLanguage()
  const narrow = useNarrow()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  // One column reads the groups in their natural order; two or three columns
  // use an order that keeps the column heights close (groups flow top to bottom)
  const cols = useToolColumns()
  const GROUPS = useMemo(() => {
    if (cols === 1) return TOOL_GROUPS
    const order = LANDING_COLUMN_ORDER[cols]
    return [...TOOL_GROUPS].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  }, [cols])
  const visibleGroups = useMemo(() => {
    if (!q) return GROUPS
    return GROUPS
      .map(g => ({
        ...g,
        rows: g.rows.filter(r =>
          `${t(r.titleKey)} ${t(r.descKey)} ${r.keywords}`.toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.rows.length > 0)
  }, [q, t, GROUPS])

  const fmt2 = (v: number) => v.toFixed(2)
  const fmt3 = (v: number) => v.toFixed(3)

  return (
    <>
      <style>{`
        .mz { background: var(--qh-bg); color: var(--qh-text); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh;
          --mz-soft: color-mix(in srgb, var(--qh-text) 76%, var(--qh-bg));
          --mz-band: color-mix(in srgb, var(--qh-surface) 55%, var(--qh-bg)); }
        .mz a { text-decoration: none; }
        .mz-wrap { max-width: 1200px; margin: 0 auto; padding-inline: 24px; }
        .mz-band { background: var(--mz-band); border-top: 1px solid var(--qh-border); border-bottom: 1px solid var(--qh-border); }
        .mz-sec { padding-block: 80px; }
        .mz-h2 { margin: 0 0 10px; font-size: clamp(24px, 3.4vw, 34px); font-weight: 700; letter-spacing: -0.5px; line-height: 1.25; }
        .mz-lead { margin: 0 0 32px; font-size: 16px; line-height: 1.75; color: var(--mz-soft); max-width: 680px; }
        .mz-card { background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 14px; }
        .mz-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px; }
        .mz-btn { min-height: 52px; padding: 0 24px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 10px; font-size: 16px; font-weight: 700; transition: transform .2s ease, box-shadow .2s ease; }
        .mz-btn:hover { transform: translateY(-1px); }
        .mz-btn-primary { background: var(--qh-accent); color: var(--qh-onAccent); }
        .mz-btn-ghost { border: 1px solid color-mix(in srgb, var(--qh-text) 22%, transparent); color: var(--qh-text); font-weight: 600; }
        .mz-chip { padding: 6px 12px; border: 1px solid var(--qh-border); border-radius: 6px; font-size: 13px; color: var(--mz-soft); }
        .mz-pro { font-size: 11px; font-weight: 800; letter-spacing: .5px; color: var(--qh-onGold); background: var(--qh-gold); border-radius: 5px; padding: 2px 7px; white-space: nowrap; }
        .mz-icon { width: 44px; height: 44px; border-radius: 10px; background: var(--qh-surface2); color: var(--qh-text); display: flex; align-items: center; justify-content: center; flex: none; }
        .mz-num { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-variant-numeric: tabular-nums; }
        .mz-flip { flex: none; }
        [dir="rtl"] .mz-flip { transform: scaleX(-1); }

        .mz-hero { display: flex; flex-wrap: wrap; align-items: center; gap: 56px; padding-block: 132px 72px; }
        .mz-hero > div { flex: 1 1 440px; min-width: 0; }
        .mz-h1 { margin: 0 0 20px; font-size: clamp(34px, 5.6vw, 56px); line-height: 1.12; font-weight: 700; letter-spacing: -1.2px; }
        [dir="rtl"] .mz-h1 { letter-spacing: 0; line-height: 1.35; }
        .mz-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 40px; }
        .mz-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
        .mz-kpi { background: var(--qh-bg); border-radius: 8px; padding: 10px 12px; min-width: 0; }

        .mz-why { padding: 26px; }
        .mz-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 32px; }

        .mz-tools-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 20px; margin-bottom: 32px; }
        .mz-search { display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; border: 1px solid var(--qh-border); border-radius: 10px; background: var(--qh-bg); width: 320px; max-width: 100%; color: var(--qh-muted); }
        .mz-search input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--qh-text); font: inherit; font-size: 14px; }
        .mz-search:focus-within { border-color: var(--qh-accent); }
        .mz-groups { column-count: 3; column-gap: 16px; }
        .mz-groups > .mz-group { break-inside: avoid; display: block; margin-bottom: 16px; }
        @media (max-width: 1100px) { .mz-groups { column-count: 2; } }
        @media (max-width: 720px) { .mz-groups { column-count: 1; } }
        .mz-hint { margin: 0; padding: 12px 0 18px; border-top: 1px solid var(--qh-border); font-size: 13px; line-height: 1.6; color: var(--qh-muted); }
        .mz-hint a { color: var(--qh-text); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
        .mz-group { padding: 0 22px; }
        .mz-group summary { list-style: none; cursor: pointer; padding: 20px 0 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .mz-group summary::-webkit-details-marker { display: none; }
        .mz-chev { color: var(--qh-muted); transition: transform .2s ease; margin-top: 4px; display: none; }
        .mz-group[open] .mz-chev { transform: rotate(180deg); }
        .mz-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--qh-border); color: var(--qh-text); min-height: 48px; }
        .mz-row:last-child { padding-bottom: 18px; }
        .mz-row:hover .mz-row-title { text-decoration: underline; text-underline-offset: 3px; }

        .mz-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 16px; }
        .mz-plan { padding: 26px; display: flex; flex-direction: column; }
        .mz-plan ul { margin: 0 0 22px; padding-inline-start: 18px; font-size: 14px; line-height: 2; color: var(--mz-soft); flex: 1; }

        @media (max-width: 640px) {
          .mz-wrap { padding-inline: 16px; }
          .mz-sec { padding-block: 48px; }
          .mz-hero { padding-block: 96px 40px; gap: 32px; }
          .mz-hero > div { flex-basis: 100%; }
          .mz-ctas { flex-direction: column; }
          .mz-ctas .mz-btn { width: 100%; }
          .mz-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .mz-why { padding: 18px; }
          .mz-group { padding: 0 14px; }
          .mz-group summary { padding: 14px 0; min-height: 52px; align-items: center; }
          .mz-chev { display: block; }
          .mz-plan { padding: 20px; }
        }
      `}</style>

      <main className="mz">

        {/* ── Nav (fixed) ── */}
        <nav className="qh-landing-nav" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 48px',height:64,background:'color-mix(in srgb, var(--qh-bg) 90%, transparent)',backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',borderBottom:'1px solid var(--qh-border)'}}>
          <Link href="/" aria-label={SITE.name} style={{display:'flex',alignItems:'center',flexShrink:0,marginInlineEnd:12}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="qh-brand-logo" src={dark ? SITE.logo.dark : SITE.logo.light} alt={SITE.name} style={{height:38,width:'auto',display:'block'}} />
          </Link>
          <div className="qh-landing-nav-right" style={{display:'flex',alignItems:'center',gap:22}}>
            <a href="#tools" className="qh-hide-mobile" style={{fontSize:14,color:'var(--qh-muted)',fontWeight:500}}>{t('nav_tools')}</a>
            <a href="/pricing" className="qh-hide-mobile" style={{fontSize:14,color:'var(--qh-muted)',fontWeight:500}}>{t('nav_pricing')}</a>
            <a href="/about" className="qh-hide-mobile" style={{fontSize:14,color:'var(--qh-muted)',fontWeight:500}}>{t('nav_about')}</a>
            <a href="/contact" className="qh-hide-mobile" style={{fontSize:14,color:'var(--qh-muted)',fontWeight:500}}>{t('nav_contact')}</a>
            <a href="/download" style={{fontSize:13,color:'var(--qh-muted)',fontWeight:600,whiteSpace:'nowrap'}}>{t('nav_getapp')}</a>
            <AuthStatus />
            <LanguageToggle theme={theme} />
            <button
              type="button"
              onClick={() => setTheme(m => m === 'dark' ? 'light' : 'dark')}
              aria-label={dark ? t('theme_light') : t('theme_dark')}
              style={{background:'var(--qh-surface2)',border:'1px solid var(--qh-border)',borderRadius:20,padding:'5px 14px',color:'var(--qh-text)',cursor:'pointer',fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}
            >
              {dark ? '☀️' : '🌙'}<span className="qh-hide-small"> {dark ? t('theme_light') : t('theme_dark')}</span>
            </button>
            <GetProLink label={t('nav_getpro')} className="qh-hide-mobile" style={{background:'var(--qh-gold)',color:'var(--qh-onGold)',fontWeight:700,fontSize:13,padding:'8px 18px',borderRadius:8,whiteSpace:'nowrap'}} />
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="mz-wrap mz-hero">
          <div>
            <p style={{margin:'0 0 18px',fontSize:13,fontWeight:600,color:'var(--mz-soft)',letterSpacing:.3}}>{t('home_eyebrow')}</p>
            <h1 className="mz-h1">
              {t('home_title_1')} <span style={{color:'var(--qh-gold)'}}>{t('home_title_2')}</span>
            </h1>
            <p style={{margin:'0 0 32px',fontSize:18,lineHeight:1.7,color:'var(--mz-soft)',maxWidth:560}}>{t('home_sub')}</p>
            <div className="mz-ctas">
              <Link href="/spc" className="mz-btn mz-btn-primary">{t('home_cta_try')} <Arrow /></Link>
              <Link href="/sample-reports" className="mz-btn mz-btn-ghost">{t('home_cta_sample')}</Link>
            </div>
            <p style={{margin:'0 0 12px',fontSize:12,fontWeight:600,color:'var(--qh-muted)',letterSpacing:lang === 'ar' ? 0 : 1.1,textTransform:'uppercase'}}>{t('home_standards_label')}</p>
            <div dir="ltr" style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:lang === 'ar' ? 'flex-end' : 'flex-start'}}>
              {STANDARDS.map(s => <span key={s} className="mz-chip">{s}</span>)}
            </div>
          </div>

          {/* Live example */}
          <div className="mz-card" style={{padding:22,boxShadow:'0 30px 80px rgba(0,0,0,0.18)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:12,flexWrap:'wrap'}}>
              <div style={{minWidth:0}}>
                <div dir="ltr" style={{fontWeight:600,fontSize:15,textAlign:'start'}}>SPC Engine · I-MR</div>
                <div style={{fontSize:12,color:'var(--qh-muted)'}}>{t('home_preview_meta')}</div>
              </div>
              <span style={{fontSize:12,color:'var(--qh-muted)',border:'1px solid var(--qh-border)',borderRadius:6,padding:'3px 10px'}}>{t('home_preview_badge')}</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,color:'var(--qh-good)',background:'color-mix(in srgb, var(--qh-good) 12%, transparent)',borderRadius:6,padding:'6px 10px'}}><IconCheck />{t('home_preview_stable')}</span>
              <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,color:'var(--qh-danger)',background:'color-mix(in srgb, var(--qh-danger) 12%, transparent)',borderRadius:6,padding:'6px 10px'}}><IconAlert />{t('home_preview_capable').replace('{v}', fmt2(exCpk))}</span>
            </div>
            <ExampleChart label={t('home_preview_chart_aria')} />
            <div className="mz-kpis">
              <div className="mz-kpi"><div style={{fontSize:11,color:'var(--qh-muted)'}}>{t('home_preview_mean')}</div><div className="mz-num" style={{fontSize:17,fontWeight:600}}>{fmt3(exMean)}</div></div>
              <div className="mz-kpi"><div style={{fontSize:11,color:'var(--qh-muted)'}}>{t('home_preview_sigma')}</div><div className="mz-num" style={{fontSize:17,fontWeight:600}}>{fmt3(exSigmaWithin)}</div></div>
              <div className="mz-kpi"><div style={{fontSize:11,color:'var(--qh-muted)'}}>Cpk</div><div className="mz-num" style={{fontSize:17,fontWeight:600,color:'var(--qh-danger)'}}>{fmt2(exCpk)}</div></div>
              <div className="mz-kpi"><div style={{fontSize:11,color:'var(--qh-muted)'}}>Ppk</div><div className="mz-num" style={{fontSize:17,fontWeight:600,color:'var(--qh-amber)'}}>{fmt2(exPpk)}</div></div>
            </div>
          </div>
        </section>

        {/* ── Why ── */}
        <section className="mz-band">
          <div className="mz-wrap mz-sec">
            <h2 className="mz-h2">{t('home_why_title')}</h2>
            <p className="mz-lead">{t('home_why_sub')}</p>
            <div className="mz-grid">
              {([
                [<IconShield key="i" />, 'home_why_1_title', 'home_why_1_body'],
                [<IconReport key="i" />, 'home_why_2_title', 'home_why_2_body'],
                [<IconScreen key="i" />, 'home_why_3_title', 'home_why_3_body'],
              ] as const).map(([icon, title, body]) => (
                <div key={title} className="mz-card mz-why">
                  <span className="mz-icon" style={{marginBottom:18}}>{icon}</span>
                  <h3 style={{margin:'0 0 8px',fontSize:19,fontWeight:600}}>{t(title)}</h3>
                  <p style={{margin:0,fontSize:15,lineHeight:1.7,color:'var(--mz-soft)'}}>{t(body)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="mz-wrap mz-sec">
          <h2 className="mz-h2" style={{marginBottom:32}}>{t('home_steps_title')}</h2>
          <div className="mz-steps">
            {([
              ['01', 'home_step_1_title', 'home_step_1_body'],
              ['02', 'home_step_2_title', 'home_step_2_body'],
              ['03', 'home_step_3_title', 'home_step_3_body'],
            ] as const).map(([n, title, body]) => (
              <div key={n}>
                <div className="mz-num" style={{fontSize:14,color:'var(--qh-gold)',marginBottom:10}}>{n}</div>
                <h3 style={{margin:'0 0 8px',fontSize:19,fontWeight:600}}>{t(title)}</h3>
                <p style={{margin:0,fontSize:15,lineHeight:1.7,color:'var(--mz-soft)'}}>{t(body)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tools by question ── */}
        <section id="tools" className="mz-band" style={{scrollMarginTop:64}}>
          <div className="mz-wrap mz-sec">
            <div className="mz-tools-head">
              <div>
                <h2 className="mz-h2">{t('home_tools_title')}</h2>
                <p style={{margin:0,fontSize:16,color:'var(--mz-soft)'}}>{t('home_tools_sub').replace('{n}', String(TOOL_COUNT))}</p>
              </div>
              <label className="mz-search">
                <IconSearch />
                <span style={{position:'absolute',width:1,height:1,overflow:'hidden',clip:'rect(0 0 0 0)'}}>{t('home_search_label')}</span>
                <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('home_search_placeholder')} />
              </label>
            </div>

            {visibleGroups.length === 0 ? (
              <p style={{margin:0,fontSize:15,color:'var(--mz-soft)'}}>{t('home_search_empty').replace('{q}', query.trim())}</p>
            ) : (
              <div className="mz-groups">
                {visibleGroups.map((g, gi) => (
                  // Re-mount when the layout or search changes so the open state resets:
                  // all open on desktop and while searching, only the first open on phones.
                  <details key={`${g.id}-${narrow ? 'n' : 'w'}-${q ? 's' : ''}`} className="mz-card mz-group" open={!narrow || !!q || gi === 0}>
                    <summary>
                      <span>
                        <span style={{display:'block',fontSize:12,fontWeight:600,color:'var(--qh-muted)',textTransform:'uppercase',letterSpacing:lang === 'ar' ? 0 : 1,marginBottom:4}}>{t(g.labelKey)}</span>
                        <span style={{display:'block',fontSize:18,fontWeight:600,color:'var(--qh-text)'}}>{t(g.questionKey)}</span>
                      </span>
                      <IconChevron />
                    </summary>
                    {g.rows.map(r => (
                      <Link key={r.href} href={r.href} className="mz-row">
                        <span style={{minWidth:0}}>
                          <span className="mz-row-title" style={{display:'block',fontWeight:600,fontSize:15}}>{t(r.titleKey)}</span>
                          <span style={{display:'block',fontSize:13,color:'var(--qh-muted)',lineHeight:1.6}}>{t(r.descKey)}</span>
                        </span>
                        {r.pro && <span className="mz-pro">PRO</span>}
                      </Link>
                    ))}
                    {g.id === 'stability' && !q && (
                      <p className="mz-hint">{t('home_stability_hint')}</p>
                    )}
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Arabic band (English visitors only — Arabic visitors already see it) ── */}
        {lang === 'en' && (
          <section className="mz-wrap mz-sec" style={{display:'flex',flexWrap:'wrap',gap:48,alignItems:'center'}}>
            <div style={{flex:'1 1 400px',minWidth:0}}>
              <h2 className="mz-h2" style={{fontSize:'clamp(22px,3vw,30px)'}}>{t('home_ar_title')}</h2>
              <p style={{margin:0,fontSize:16,lineHeight:1.7,color:'var(--mz-soft)'}}>{t('home_ar_body')}</p>
            </div>
            <div dir="rtl" lang="ar" className="mz-card" style={{flex:'1 1 400px',minWidth:0,padding:24}}>
              <div style={{fontSize:13,color:'var(--qh-muted)',marginBottom:8}}>الحكم</div>
              <div style={{fontSize:20,fontWeight:600,marginBottom:8}}>العملية مستقرة إحصائيًا لكنها غير قادرة</div>
              <p style={{margin:0,fontSize:15,lineHeight:1.85,color:'var(--mz-soft)'}}>
                قيمة Cpk تساوي {fmt2(exCpk)} وهي أقل من الهدف 1.33. التشتت يستهلك {Math.round((6 * exSigmaWithin) / (EX_USL - EX_LSL) * 100)}% من مدى التفاوت، والمتوسط أعلى من منتصف المواصفة بمقدار {fmt3(exMean - (EX_USL + EX_LSL) / 2)}.
              </p>
            </div>
          </section>
        )}

        {/* ── Pricing teaser ── */}
        <section id="pricing" className={lang === 'en' ? 'mz-band' : ''} style={lang === 'en' ? undefined : {borderTop:'1px solid var(--qh-border)'}}>
          <div className="mz-wrap mz-sec">
            <h2 className="mz-h2">{t('home_price_title')}</h2>
            <p className="mz-lead">{t('home_price_sub')}</p>
            <div className="mz-plans">
              <div className="mz-card mz-plan">
                <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>{t('home_plan_anon')}</div>
                <div style={{fontSize:28,fontWeight:700,marginBottom:16}}>{t('home_plan_free_price')}</div>
                <ul><li>{t('home_plan_anon_1')}</li><li>{t('home_plan_anon_2')}</li></ul>
                <Link href="/spc" className="mz-btn mz-btn-ghost" style={{minHeight:46,fontSize:15}}>{t('home_cta_try')}</Link>
              </div>
              <div className="mz-card mz-plan">
                <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>{t('home_plan_free')}</div>
                <div style={{fontSize:28,fontWeight:700,marginBottom:16}}>{t('home_plan_free_price')}</div>
                <ul><li>{t('home_plan_free_1')}</li><li>{t('home_plan_free_2')}</li></ul>
                <Link href="/login" className="mz-btn mz-btn-primary" style={{minHeight:46,fontSize:15}}>{t('home_plan_free_cta')}</Link>
              </div>
              <div className="mz-card mz-plan" style={{borderColor:'var(--qh-gold)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:16,marginBottom:4}}>Pro <span className="mz-pro">{t('home_plan_pro_soon')}</span></div>
                <div style={{fontSize:18,fontWeight:600,marginBottom:16,minHeight:42,display:'flex',alignItems:'center',color:'var(--qh-muted)'}}>{t('home_plan_pro_price')}</div>
                <ul><li>Gage R&amp;R</li><li>{t('home_plan_pro_2')}</li><li>{t('home_plan_pro_3')}</li></ul>
                <Link href="/pricing" className="mz-btn" style={{minHeight:46,fontSize:15,border:'1px solid var(--qh-gold)',color:'var(--qh-gold)'}}>{t('home_plan_pro_cta')}</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{borderTop:'1px solid var(--qh-border)'}}>
          <div className="mz-wrap" style={{paddingBlock:28,display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:16,fontSize:13,color:'var(--qh-muted)'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dark ? SITE.logo.dark : SITE.logo.light} alt={SITE.name} style={{height:30,width:'auto',display:'block'}} />
              <span>{t('home_footer_tagline')}</span>
            </div>
            <nav aria-label={t('home_footer_nav')} style={{display:'flex',flexWrap:'wrap',gap:20}}>
              <a href="/guide" style={{color:'var(--qh-muted)',minHeight:32,display:'flex',alignItems:'center'}}>{t('footer_guide')}</a>
              <a href="/sample-reports" style={{color:'var(--qh-muted)',minHeight:32,display:'flex',alignItems:'center'}}>{t('footer_sample_reports')}</a>
              <a href="/about" style={{color:'var(--qh-muted)',minHeight:32,display:'flex',alignItems:'center'}}>{t('footer_about')}</a>
              <a href="/contact" style={{color:'var(--qh-muted)',minHeight:32,display:'flex',alignItems:'center'}}>{t('footer_contact')}</a>
            </nav>
            <div style={{width:'100%'}}>© {SITE.copyrightYear} {SITE.name} · {t('home_footer_built')}</div>
          </div>
        </footer>
      </main>
    </>
  )
}
