'use client'

import { useState } from 'react'
import Link from 'next/link'
import { COLORS, usePersistedTheme, type ThemeMode } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

interface ToolCardData {
  href: string | null // null = "coming soon", card is not a link
  icon: string
  iconBg: string
  iconBorder: string
  titleKey: TKey
  descKey: TKey
  tags: string[]
  live: boolean
}

interface ToolSectionData {
  id: string
  labelKey: TKey
  titleKey: TKey
  descKey: TKey
  tools: ToolCardData[]
}

// Grouped by discipline (matches the categories quality engineers actually
// think in — see /pricing and dashboard for the same tool set). Each
// section gets its own anchor for the quick-jump nav above the grid.
const TOOL_SECTIONS: ToolSectionData[] = [
  {
    id: 'section-stability',
    labelKey: 'section_stability_label',
    titleKey: 'section_stability_title',
    descKey: 'section_stability_desc',
    tools: [
      { href: '/spc', icon: '📊', iconBg: 'rgba(15,212,200,.1)', iconBorder: 'rgba(15,212,200,.2)', titleKey: 'spc_title', descKey: 'spc_desc', tags: ['Cp·Cpk·Pp·Ppk', 'Nelson Rules', 'Sigma Level', 'PPM'], live: true },
      { href: '/imr-chart', icon: '📊', iconBg: 'rgba(236,72,153,.1)', iconBorder: 'rgba(236,72,153,.2)', titleKey: 'imr_title', descKey: 'imr_desc', tags: ['Individuals Chart', 'Moving Range', 'Nelson Rules', 'Capability'], live: true },
      { href: '/xbar-r-chart', icon: '📈', iconBg: 'rgba(20,184,166,.1)', iconBorder: 'rgba(20,184,166,.2)', titleKey: 'xbar_r_title', descKey: 'xbar_r_desc', tags: ['Subgrouped Data', 'X̄ Chart', 'Range Chart', 'Nelson Rules'], live: true },
      { href: '/xbar-s-chart', icon: '📈', iconBg: 'rgba(6,182,212,.1)', iconBorder: 'rgba(6,182,212,.2)', titleKey: 'xbar_s_title', descKey: 'xbar_s_desc', tags: ['Subgrouped Data', 'X̄ Chart', 'Std Dev Chart', 'Nelson Rules'], live: true },
    ],
  },
  {
    id: 'section-msa',
    labelKey: 'section_msa_label',
    titleKey: 'section_msa_title',
    descKey: 'section_msa_desc',
    tools: [
      { href: '/gage-rr', icon: '🎯', iconBg: 'rgba(232,160,32,.1)', iconBorder: 'rgba(232,160,32,.2)', titleKey: 'gagerr_title', descKey: 'gagerr_desc', tags: ['AIAG MSA', 'EV/AV/GRR', 'NDC'], live: true },
    ],
  },
  {
    id: 'section-regression',
    labelKey: 'section_regression_label',
    titleKey: 'section_regression_title',
    descKey: 'section_regression_desc',
    tools: [
      { href: '/regression', icon: '📈', iconBg: 'rgba(59,130,246,.1)', iconBorder: 'rgba(59,130,246,.2)', titleKey: 'regression_title', descKey: 'regression_desc', tags: ['OLS Fit', 'ANOVA', 'Residual Diagnostics', 'Prediction Intervals'], live: true },
      { href: '/multiregression', icon: '📉', iconBg: 'rgba(99,102,241,.1)', iconBorder: 'rgba(99,102,241,.2)', titleKey: 'multiregression_title', descKey: 'multiregression_desc', tags: ['Multiple Predictors', 'VIF', 'ANOVA', 'Prediction Intervals'], live: true },
    ],
  },
  {
    id: 'section-sampling',
    labelKey: 'section_sampling_label',
    titleKey: 'section_sampling_title',
    descKey: 'section_sampling_desc',
    tools: [
      { href: '/aql', icon: '📋', iconBg: 'rgba(168,85,247,.1)', iconBorder: 'rgba(168,85,247,.2)', titleKey: 'aql_title', descKey: 'aql_desc', tags: ['ISO 2859-1', 'Ac/Re Tables', 'CSV/Excel/PDF Export'], live: true },
      { href: '/icmsf', icon: '🧫', iconBg: 'rgba(34,197,94,.1)', iconBorder: 'rgba(34,197,94,.2)', titleKey: 'icmsf_title', descKey: 'icmsf_desc', tags: ['ICMSF Case Selector', 'n/c/m/M', 'OC Curve'], live: true },
    ],
  },
  {
    id: 'section-quality',
    labelKey: 'section_quality_label',
    titleKey: 'section_quality_title',
    descKey: 'section_quality_desc',
    tools: [
      { href: '/pareto', icon: '📈', iconBg: 'rgba(245,158,11,.1)', iconBorder: 'rgba(245,158,11,.2)', titleKey: 'pareto_title', descKey: 'pareto_desc', tags: ['80/20 Rule', 'Excel Import', 'PDF Export'], live: true },
      { href: '/dpmo', icon: '🎯', iconBg: 'rgba(59,130,246,.1)', iconBorder: 'rgba(59,130,246,.2)', titleKey: 'dpmo_title', descKey: 'dpmo_desc', tags: ['Six Sigma', 'DPMO', 'Yield %'], live: true },
      { href: '/oee', icon: '⚙️', iconBg: 'rgba(15,212,200,.1)', iconBorder: 'rgba(15,212,200,.2)', titleKey: 'oee_title', descKey: 'oee_desc', tags: ['JIPM TPM', 'Six Big Losses', 'CSV/Excel/PDF Export'], live: true },
      { href: null, icon: '⚠️', iconBg: 'rgba(239,68,68,.08)', iconBorder: 'rgba(239,68,68,.12)', titleKey: 'fmea_title', descKey: 'fmea_desc', tags: [], live: false },
    ],
  },
  {
    id: 'section-descriptive',
    labelKey: 'section_descriptive_label',
    titleKey: 'section_descriptive_title',
    descKey: 'section_descriptive_desc',
    tools: [
      { href: '/descriptive', icon: '📐', iconBg: 'rgba(20,184,166,.1)', iconBorder: 'rgba(20,184,166,.2)', titleKey: 'descriptive_title', descKey: 'descriptive_desc', tags: ['Mean/Median/StdDev', 'Histogram', 'Confidence Intervals'], live: true },
    ],
  },
  {
    id: 'section-reliability',
    labelKey: 'section_reliability_label',
    titleKey: 'section_reliability_title',
    descKey: 'section_reliability_desc',
    tools: [
      { href: '/stability', icon: '🧪', iconBg: 'rgba(15,212,200,.1)', iconBorder: 'rgba(15,212,200,.2)', titleKey: 'stability_title', descKey: 'stability_desc', tags: ['ICH Q1E', 'Shelf-Life', 'CSV/Excel/PDF Export'], live: true },
    ],
  },
]

export default function Home() {
  const [theme, setTheme] = usePersistedTheme()
  const dark = theme === 'dark'
  const c = COLORS[theme]
  const { t, dict } = useLanguage()

  // A few landing-page-specific tokens that aren't part of the shared
  // component theme (hero gradients, card surfaces) but still need a
  // light-mode counterpart. Defined here, once, instead of scattered
  // through the JSX below.
  const bg = dark ? '#060d1a' : c.bg
  const text = dark ? '#f0f6ff' : c.text
  const navLinkColor = dark ? '#8fafd4' : c.muted
  const cardBg = dark ? 'rgba(11,22,40,.9)' : c.surface
  const cardBorder = dark ? 'rgba(15,212,200,.2)' : c.border
  const comingSoonBg = dark ? 'rgba(11,22,40,.45)' : c.surface2
  const comingSoonBorder = dark ? 'rgba(255,255,255,.04)' : c.border
  const footerBorder = dark ? 'rgba(255,255,255,.05)' : c.border
  const footerMuted = dark ? '#6b89b4' : c.muted
  const glowOpacity = dark ? 1 : 0 // the animated background glows are dark-mode only

  const featurePills = [dict.pill_1, dict.pill_2, dict.pill_3, dict.pill_4, dict.pill_5, dict.pill_6]

  return (
    <>
      <style>{`
        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1);opacity:.4} 50%{transform:translate(40px,-60px) scale(1.15);opacity:.65} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1);opacity:.3} 50%{transform:translate(-30px,40px) scale(.85);opacity:.5} }
        @keyframes float3 { 0%,100%{transform:translate(0,0);opacity:.2} 33%{transform:translate(20px,-30px)} 66%{transform:translate(-15px,20px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .fu{animation:fadeUp .75s ease forwards;opacity:0}
        .fu1{animation-delay:.1s} .fu2{animation-delay:.28s} .fu3{animation-delay:.46s} .fu4{animation-delay:.62s}
        .card{transition:transform .3s ease,border-color .3s ease,box-shadow .3s ease}
        .card:hover{transform:translateY(-7px);box-shadow:0 24px 64px rgba(15,212,200,.1)}
        .btn{transition:transform .25s ease,box-shadow .25s ease}
        .btn:hover{transform:translateY(-2px);box-shadow:0 14px 44px rgba(15,212,200,.35)}
        .nl{transition:color .2s} .nl:hover{color:#0fd4c8!important}
      `}</style>

      <main style={{background:bg,color:text,fontFamily:"'Inter',system-ui,sans-serif",minHeight:'100vh',transition:'background .25s ease,color .25s ease'}}>

        {/* ── Animated Background (dark mode only) ── */}
        <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden',opacity:glowOpacity,transition:'opacity .25s ease'}}>
          <div style={{position:'absolute',top:'-15%',left:'-8%',width:800,height:800,borderRadius:'50%',background:'radial-gradient(circle,rgba(15,212,200,.13) 0%,transparent 68%)',animation:'float1 13s ease-in-out infinite'}}/>
          <div style={{position:'absolute',top:'45%',right:'-12%',width:650,height:650,borderRadius:'50%',background:'radial-gradient(circle,rgba(0,168,150,.1) 0%,transparent 68%)',animation:'float2 16s ease-in-out infinite'}}/>
          <div style={{position:'absolute',bottom:'-8%',left:'28%',width:550,height:550,borderRadius:'50%',background:'radial-gradient(circle,rgba(232,160,32,.07) 0%,transparent 68%)',animation:'float3 20s ease-in-out infinite'}}/>
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(15,212,200,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(15,212,200,.025) 1px,transparent 1px)',backgroundSize:'64px 64px'}}/>
        </div>

        {/* ── Nav ── */}
        <nav className="qh-landing-nav" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 48px',height:64,background:dark?'rgba(6,13,26,.88)':'rgba(255,255,255,.92)',backdropFilter:'blur(24px)',borderBottom:`1px solid ${dark?'rgba(15,212,200,.07)':c.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:11,fontWeight:800,fontSize:17}}>
            <div style={{width:36,height:36,background:'linear-gradient(135deg,#0fd4c8,#00a896)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',color:'#060d1a',fontWeight:900,fontSize:16}}>σ</div>
            Quality Tools
          </div>
          <div className="qh-landing-nav-right" style={{display:'flex',alignItems:'center',gap:24}}>
            <a href="#tools" className="nl qh-hide-mobile" style={{fontSize:14,color:navLinkColor,textDecoration:'none',fontWeight:500}}>{t('nav_tools')}</a>
            <a href="/pricing" className="nl qh-hide-mobile" style={{fontSize:14,color:navLinkColor,textDecoration:'none',fontWeight:500}}>{t('nav_pricing')}</a>
            <a href="/about" className="nl qh-hide-mobile" style={{fontSize:14,color:navLinkColor,textDecoration:'none',fontWeight:500}}>{t('nav_about')}</a>
            <a href="/contact" className="nl qh-hide-mobile" style={{fontSize:14,color:navLinkColor,textDecoration:'none',fontWeight:500}}>{t('nav_contact')}</a>
            <a href="/download" className="nl" style={{fontSize:13,color:navLinkColor,textDecoration:'none',fontWeight:600,whiteSpace:'nowrap'}}>{t('nav_getapp')}</a>
           <AuthStatus />
            <LanguageToggle theme={theme} />
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              style={{background:dark?'rgba(255,255,255,0.08)':c.surface2,border:`1px solid ${c.border}`,borderRadius:20,padding:'5px 14px',color:text,cursor:'pointer',fontSize:12,fontWeight:600}}
            >
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>
            <a href="/pricing" className="qh-hide-mobile" style={{background:'linear-gradient(135deg,#0fd4c8,#00a896)',color:'#060d1a',fontWeight:700,fontSize:13,padding:'8px 20px',borderRadius:8,textDecoration:'none'}}>{t('nav_getpro')} →</a>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="qh-landing-hero" style={{position:'relative',zIndex:1,minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'120px 24px 80px'}}>

          <div className="fu fu1" style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(15,212,200,.07)',border:'1px solid rgba(15,212,200,.2)',borderRadius:100,padding:'7px 18px',fontSize:11,fontWeight:700,color:'#0fd4c8',letterSpacing:'2px',textTransform:'uppercase',marginBottom:40}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#0fd4c8',display:'inline-block',animation:'pulse 2s infinite'}}/>
            {t('hero_badge')}
          </div>

          <h1 className="fu fu2" style={{fontSize:'clamp(42px,6.5vw,90px)',fontWeight:900,lineHeight:1.02,letterSpacing:-3,marginBottom:24,maxWidth:960}}>
            {t('hero_title_1')}<br/>
            <span style={{background:'linear-gradient(90deg,#0fd4c8 0%,#00d4b0 45%,#e8a020 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
              {t('hero_title_2')}
            </span>
          </h1>

          <p className="fu fu3" style={{fontSize:19,color:c.muted,maxWidth:560,lineHeight:1.75,margin:'0 auto 52px',fontWeight:300}}>
            {t('hero_sub')}
          </p>

          <div className="fu fu4" style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center',marginBottom:72}}>
            <a href="#tools" className="btn" style={{background:'linear-gradient(135deg,#0fd4c8,#00a896)',color:'#060d1a',fontWeight:700,fontSize:15,padding:'15px 38px',borderRadius:12,textDecoration:'none'}}>
              {t('hero_cta_explore')} →
            </a>
            <a href="/pricing" style={{border:'1px solid rgba(15,212,200,.2)',color:'#0fd4c8',fontSize:14,fontWeight:500,padding:'15px 28px',borderRadius:12,textDecoration:'none',background:'rgba(15,212,200,.04)'}}>
              {t('hero_cta_pricing')} →
            </a>
          </div>

          {/* Feature pills */}
          <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
            {featurePills.map(f=>(
              <span key={f} style={{fontSize:12,color:c.muted,background:dark?'rgba(255,255,255,.03)':c.surface2,border:`1px solid ${dark?'rgba(255,255,255,.07)':c.border}`,borderRadius:20,padding:'6px 14px'}}>{f}</span>
            ))}
          </div>
        </section>

        {/* ── Tools ── */}
        <section id="tools" className="qh-landing-section" style={{position:'relative',zIndex:1,maxWidth:1100,margin:'0 auto',padding:'100px 32px'}}>
          <p style={{fontSize:11,fontWeight:700,letterSpacing:3,textTransform:'uppercase',color:'#0fd4c8',marginBottom:14}}>{t('tools_label')}</p>
          <h2 style={{fontSize:'clamp(30px,4vw,50px)',fontWeight:800,letterSpacing:-1.5,marginBottom:12,lineHeight:1.1}}>
            {t('tools_h1')}<br/>{t('tools_h2')}
          </h2>
          <p style={{fontSize:15,color:c.muted,maxWidth:440,fontWeight:300,lineHeight:1.7,marginBottom:32}}>
            {t('tools_sub')}
          </p>

          {/* Quick-jump section nav */}
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:64}}>
            {TOOL_SECTIONS.map(section=>(
              <a
                key={section.id}
                href={`#${section.id}`}
                style={{fontSize:12,fontWeight:600,color:dark?'#8fafd4':c.muted,background:dark?'rgba(255,255,255,.03)':c.surface2,border:`1px solid ${dark?'rgba(255,255,255,.08)':c.border}`,borderRadius:20,padding:'7px 16px',textDecoration:'none',transition:'color .2s,border-color .2s'}}
                className="nl"
              >
                {t(section.labelKey)}
              </a>
            ))}
          </div>

          {TOOL_SECTIONS.map((section, sIdx)=>(
            <div key={section.id} id={section.id} style={{marginBottom: sIdx === TOOL_SECTIONS.length-1 ? 0 : 72, scrollMarginTop: 90}}>
              <h3 style={{fontSize:'clamp(20px,2.4vw,26px)',fontWeight:800,letterSpacing:-0.5,marginBottom:8}}>
                {t(section.titleKey)}
              </h3>
              <p style={{fontSize:14,color:c.muted,maxWidth:560,fontWeight:300,lineHeight:1.6,marginBottom:28}}>
                {t(section.descKey)}
              </p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:20}}>
                {section.tools.map(tool=>{
                  const cardInner = (
                    <>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div style={{width:52,height:52,borderRadius:14,background:tool.iconBg,border:`1px solid ${tool.iconBorder}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>{tool.icon}</div>
                        {tool.live ? (
                          <span style={{fontSize:10,fontWeight:700,padding:'4px 12px',borderRadius:20,background:'rgba(34,197,94,.1)',color:'#4ade80',border:'1px solid rgba(34,197,94,.2)',display:'flex',alignItems:'center',gap:5}}>
                            <span style={{width:5,height:5,borderRadius:'50%',background:'#4ade80',display:'inline-block',animation:'pulse 2s infinite'}}/>{t('badge_live')}
                          </span>
                        ) : (
                          <span style={{fontSize:10,fontWeight:700,padding:'4px 12px',borderRadius:20,background:'rgba(148,163,184,.06)',color:'#64748b',border:'1px solid rgba(148,163,184,.1)'}}>{t('badge_soon')}</span>
                        )}
                      </div>
                      <div>
                        <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>{t(tool.titleKey)}</div>
                        <div style={{fontSize:13,color:c.muted,lineHeight:1.75,fontWeight:300}}>{t(tool.descKey)}</div>
                      </div>
                      {tool.tags.length > 0 && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                          {tool.tags.map(tag=>(
                            <span key={tag} style={{fontSize:11,color:'#0fd4c8',background:'rgba(15,212,200,.06)',border:'1px solid rgba(15,212,200,.12)',borderRadius:20,padding:'3px 10px'}}>{tag}</span>
                          ))}
                        </div>
                      )}
                      {tool.live && <div style={{fontSize:13,fontWeight:600,color:'#0fd4c8'}}>{t('open_tool')}</div>}
                    </>
                  )
                  return tool.live && tool.href ? (
                    <Link key={tool.titleKey} href={tool.href} className="card" style={{background:cardBg,border:`1px solid ${cardBorder}`,borderRadius:20,padding:32,textDecoration:'none',color:'inherit',display:'flex',flexDirection:'column',gap:20}}>
                      {cardInner}
                    </Link>
                  ) : (
                    <div key={tool.titleKey} style={{background:comingSoonBg,border:`1px solid ${comingSoonBorder}`,borderRadius:20,padding:32,display:'flex',flexDirection:'column',gap:20,opacity:.6}}>
                      {cardInner}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        {/* ── Footer ── */}
        <footer className="qh-landing-footer" style={{position:'relative',zIndex:1,borderTop:`1px solid ${footerBorder}`,padding:'28px 48px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
  <div style={{display:'flex',alignItems:'center',gap:10,fontWeight:700,fontSize:15}}>
    <div style={{width:28,height:28,background:'linear-gradient(135deg,#0fd4c8,#00a896)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',color:'#060d1a',fontWeight:900,fontSize:13}}>σ</div>
    
    {/* التعديل هنا: تجميع الكلمة وتحديد الاتجاه LTR */}
    <span style={{ direction: 'ltr', display: 'inline-block' }}>
      Quality<span style={{color:'#0fd4c8'}}>Tools</span>
    </span>

    <span style={{color:footerMuted,fontWeight:400,fontSize:13}}>· Tawfik Elzahar</span>
  </div>
  <div style={{display:'flex',alignItems:'center',gap:20}}>
    <a href="/sample-reports" style={{fontSize:12,color:footerMuted,textDecoration:'none',fontWeight:500}}>{t('footer_sample_reports')}</a>
    <a href="/about" style={{fontSize:12,color:footerMuted,textDecoration:'none',fontWeight:500}}>{t('footer_about')}</a>
    <a href="/contact" style={{fontSize:12,color:footerMuted,textDecoration:'none',fontWeight:500}}>{t('footer_contact')}</a>
    <div style={{fontSize:12,color:footerMuted}}>© 2026 Tawfik Elzahar. {t('footer_rights')}</div>
  </div>
</footer>
      </main>
    </>
  )
}
