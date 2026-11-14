'use client'

import Link from '@/components/LocaleLink'
import { getSharedStyles, usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import { useLanguage } from '@/lib/i18n/context'
import { TOOL_GROUPS } from '@/lib/tools'
import { VERIFICATION, VERIFIED_TOOLS as TOOLS_RAW, VERIFY_COPY as COPY_RAW, TOOL_COUNT, formatRunDate, formatCount, cardChecks } from '@/lib/verification/content'
import { isolateLatinDeep } from '@/lib/i18n/bidi'

// Arabic text with its English stretches marked left to right (lib/i18n/bidi.ts)
const VERIFY_COPY = { ...COPY_RAW, ar: isolateLatinDeep(COPY_RAW.ar) }
const VERIFIED_TOOLS: typeof TOOLS_RAW = TOOLS_RAW.map(x => ({
  ...x,
  name: { ...x.name, ar: isolateLatinDeep(x.name.ar) },
  checked: { ...x.checked, ar: isolateLatinDeep(x.checked.ar) },
  ...(x.example ? { example: { ...x.example, label: { ...x.example.label, ar: isolateLatinDeep(x.example.label.ar) } } } : {}),
}))

// ─────────────────────────────────────────────────────────────────────────
// /verification — how every result is checked. Copy: lib/verification/
// content.ts · counts and date: lib/verification/results.json, written by
// scripts/validation-summary.mjs from a real run of the golden checks.
// No formulas, no full tables, no software names (owner's decisions).
// ─────────────────────────────────────────────────────────────────────────

const TOOL_TITLE = new Map(TOOL_GROUPS.flatMap(g => g.rows.map(r => [r.href, r.titleKey] as const)))

function Check({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export default function VerificationPage() {
  const [theme, setTheme] = usePersistedTheme()
  const { t, lang } = useLanguage()
  const s = getSharedStyles(theme)
  const d = VERIFY_COPY[lang]
  const nf = formatCount
  const ltr = (v: string) => <bdi dir="ltr">{v}</bdi>

  return (
    <div style={s.page}>
      <style>{`
        .vf { width: 100%; max-width: 1080px; margin: 0 auto; padding: 24px 0 72px; }
        .vf-head { text-align: center; max-width: 760px; margin: 12px auto 36px; }
        .vf-kicker { font-size: 12px; font-weight: 700; color: var(--qh-gold); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
        [dir="rtl"] .vf-kicker { letter-spacing: 0; }
        .vf-h1 { font-size: clamp(28px, 4.4vw, 42px); font-weight: 800; line-height: 1.2; letter-spacing: -0.6px; margin: 0 0 16px; color: var(--qh-text); }
        [dir="rtl"] .vf-h1 { letter-spacing: 0; line-height: 1.4; }
        .vf-intro { font-size: 16px; line-height: 1.85; color: var(--qh-muted); margin: 0; }
        .vf-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--qh-border); border-radius: 16px; background: var(--qh-surface); overflow: hidden; margin-bottom: 56px; }
        .vf-stat { padding: 22px 20px; text-align: center; }
        .vf-stat + .vf-stat { border-inline-start: 1px solid var(--qh-border); }
        .vf-stat b { display: block; font: 700 clamp(26px, 3.6vw, 36px) ui-monospace, 'SF Mono', Menlo, monospace; color: var(--qh-text); font-variant-numeric: tabular-nums; }
        .vf-stat b.gold { color: var(--qh-gold); }
        .vf-stat span { display: block; margin-top: 4px; font-size: 13px; color: var(--qh-muted); }
        .vf-h2 { font-size: clamp(21px, 2.8vw, 26px); font-weight: 750; margin: 0 0 8px; color: var(--qh-text); }
        .vf-sub { font-size: 14px; color: var(--qh-muted); margin: 0 0 20px; }
        .vf-how { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px; margin-bottom: 56px; }
        .vf-step { background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 14px; padding: 22px; }
        .vf-step i { display: inline-flex; width: 30px; height: 30px; border-radius: 50%; align-items: center; justify-content: center; font-style: normal; font-weight: 800; font-size: 14px; color: var(--qh-onGold); background: var(--qh-gold); margin-bottom: 12px; }
        .vf-step h3 { margin: 0 0 6px; font-size: 16px; color: var(--qh-text); }
        .vf-step p { margin: 0; font-size: 14px; line-height: 1.75; color: var(--qh-muted); }
        .vf-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 14px; margin-bottom: 56px; }
        .vf-card { background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 14px; padding: 20px 22px; display: flex; flex-direction: column; gap: 10px; }
        .vf-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .vf-card h3 { margin: 0; font-size: 17px; color: var(--qh-text); line-height: 1.4; }
        .vf-count { flex: none; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--qh-good); background: color-mix(in srgb, var(--qh-good) 12%, transparent); border-radius: 999px; padding: 4px 10px; white-space: nowrap; }
        .vf-refs { display: flex; flex-wrap: wrap; gap: 6px; }
        .vf-ref { font-size: 12px; padding: 3px 9px; border: 1px solid var(--qh-border); border-radius: 6px; color: var(--qh-muted); }
        .vf-card p { margin: 0; font-size: 14px; line-height: 1.75; color: var(--qh-muted); }
        .vf-ex { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; align-items: center; background: var(--qh-bg); border-radius: 10px; padding: 12px 14px; font-size: 13px; }
        .vf-ex .lab { color: var(--qh-muted); }
        .vf-ex .val { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-variant-numeric: tabular-nums; color: var(--qh-text); text-align: end; }
        .vf-ex .ok { color: var(--qh-good); display: inline-flex; align-items: center; gap: 6px; }
        .vf-links { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: auto; padding-top: 4px; font-size: 13px; }
        .vf-links a { color: var(--qh-accent); text-decoration: none; }
        .vf-links a:hover { text-decoration: underline; }
        .vf-pending { border: 1px dashed var(--qh-border); border-radius: 14px; padding: 20px 22px; margin-bottom: 40px; }
        .vf-pending ul { margin: 8px 0 0; padding-inline-start: 18px; font-size: 14px; line-height: 1.8; color: var(--qh-muted); }
        .vf-close { text-align: center; font-size: 14px; color: var(--qh-muted); line-height: 1.8; }
        .vf-close a { color: var(--qh-accent); font-weight: 600; }
        @media (max-width: 640px) {
          .vf-stats { grid-template-columns: 1fr; }
          .vf-stat + .vf-stat { border-inline-start: 0; border-top: 1px solid var(--qh-border); }
          .vf-card { padding: 18px; }
        }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_verification" showGetPro={false} />
      <main className="qh-main" style={{ ...s.main }}>
        <div className="vf">
          <header className="vf-head">
            <div className="vf-kicker">{d.kicker}</div>
            <h1 className="vf-h1">{d.title}</h1>
            <p className="vf-intro">{d.intro}</p>
          </header>

          <section className="vf-stats" aria-label={d.kicker}>
            <div className="vf-stat"><b className="gold">{nf(VERIFICATION.total)}</b><span>{d.statChecks}</span></div>
            <div className="vf-stat"><b>{nf(TOOL_COUNT)}</b><span>{d.statTools}</span></div>
            <div className="vf-stat"><b style={{ fontSize: 'clamp(19px, 2.4vw, 24px)', lineHeight: '1.5' }}>{formatRunDate(VERIFICATION.ranAt, lang)}</b><span>{d.statRun}</span></div>
          </section>

          <h2 className="vf-h2">{d.howTitle}</h2>
          <div className="vf-how" style={{ marginTop: 16 }}>
            {d.how.map((h, i) => (
              <div key={h.h} className="vf-step">
                <i>{nf(i + 1)}</i>
                <h3>{h.h}</h3>
                <p>{h.p}</p>
              </div>
            ))}
          </div>

          <h2 className="vf-h2">{d.toolsTitle}</h2>
          <p className="vf-sub">{d.toolsSub}</p>
          <div className="vf-cards">
            {VERIFIED_TOOLS.map(tool => (
              <article key={tool.suite} className="vf-card" id={tool.suite}>
                <div className="vf-card-top">
                  <h3>{tool.name[lang]}</h3>
                  <span className="vf-count"><Check size={13} />{nf(cardChecks(tool))} {d.checks}</span>
                </div>
                <div className="vf-refs" dir="ltr" style={{ justifyContent: lang === 'ar' ? 'flex-end' : 'flex-start' }}>
                  {tool.refs.map(r => <span key={r} className="vf-ref">{r}</span>)}
                </div>
                <p>{tool.checked[lang]}</p>
                {tool.example && (
                  <div className="vf-ex">
                    <span className="lab">{tool.example.label[lang]}</span>
                    <span className="val">{ltr(tool.example.value)}</span>
                    <span className="lab">{d.result}</span>
                    <span className="val ok"><Check size={14} />{ltr(tool.example.value)}</span>
                  </div>
                )}
                <div className="vf-links">
                  {tool.hrefs.map(h => <Link key={h} href={h}>{TOOL_TITLE.has(h) ? t(TOOL_TITLE.get(h)!) : h}</Link>)}
                </div>
              </article>
            ))}
          </div>

          {d.pending.length > 0 && (
            <section className="vf-pending">
              <h2 className="vf-h2" style={{ fontSize: 18 }}>{d.pendingTitle}</h2>
              <ul>{d.pending.map(p => <li key={p}>{p}</li>)}</ul>
            </section>
          )}

          <p className="vf-close">
            {d.closing}{' '}
            <Link href="/contact">{t('nav_contact')}</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
