'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'
import { TOOL_GROUPS } from '@/lib/tools'

// ─────────────────────────────────────────────────────────────────────────
// Tool list beside a tool page on wide screens, grouped by the engineer's
// question exactly like the landing page. Hidden on tablets and phones
// (below 1100px), where the top nav and the landing page take over.
// ─────────────────────────────────────────────────────────────────────────

export default function ToolSidebar({ current }: { current: string }) {
  const { t, lang } = useLanguage()

  return (
    <nav className="qh-toolnav" aria-label={t('nav_tools')}>
      <style>{`
        .qh-toolnav { width: 232px; flex: none; box-sizing: border-box; padding: 20px 12px 32px;
          border-inline-end: 1px solid var(--qh-border); background: var(--qh-bg);
          position: sticky; top: 0; align-self: flex-start; max-height: 100vh; overflow-y: auto; }
        .qh-toolnav-h { font-size: 11px; font-weight: 700; color: var(--qh-muted); padding: 16px 10px 6px; }
        .qh-toolnav > div:first-of-type .qh-toolnav-h { padding-top: 0; }
        .qh-toolnav > div + div { margin-top: 6px; }
        .qh-toolnav a { display: flex; justify-content: space-between; align-items: center; gap: 8px;
          padding: 8px 10px; border-radius: 8px; color: var(--qh-text); font-size: 13.5px; line-height: 1.35;
          text-decoration: none; opacity: .82; }
        .qh-toolnav a:hover { opacity: 1; background: var(--qh-surface); }
        .qh-toolnav a[aria-current="page"] { opacity: 1; font-weight: 600; background: var(--qh-surface2);
          box-shadow: inset 3px 0 0 var(--qh-gold); }
        [dir="rtl"] .qh-toolnav a[aria-current="page"] { box-shadow: inset -3px 0 0 var(--qh-gold); }
        .qh-toolnav-pro { font-size: 10px; font-weight: 800; letter-spacing: .5px; color: var(--qh-onGold);
          background: var(--qh-gold); border-radius: 4px; padding: 1px 5px; flex: none; }
        @media (max-width: 1099px) { .qh-toolnav { display: none; } }
      `}</style>
      {TOOL_GROUPS.map(g => (
        <div key={g.id}>
          <div className="qh-toolnav-h" style={{ textTransform: lang === 'ar' ? 'none' : 'uppercase', letterSpacing: lang === 'ar' ? 0 : 0.8 }}>
            {t(g.labelKey)}
          </div>
          {g.rows.map(r => (
            <Link key={r.href} href={r.href} aria-current={r.href === current ? 'page' : undefined}>
              <span>{t(r.titleKey)}</span>
              {r.pro && <span className="qh-toolnav-pro">PRO</span>}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}
