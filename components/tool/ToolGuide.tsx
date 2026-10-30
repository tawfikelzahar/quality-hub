import type { GuideBlock, ToolGuide as Guide } from '@/lib/guides/types'

// ─────────────────────────────────────────────────────────────────────────
// "About this tool" section under a tool: what it does, how it is
// calculated, a worked example and the references. Server component (no
// state), rendered by the tool's page in the page's language and handed to
// the tool as its `guide` prop, so the text is in the HTML Google reads.
// Closed by default (native <details>, same look as the site's other
// collapsible cards): the text is still in the page for search engines,
// which index content in accordions in full; it is only folded for people.
// Content lives in lib/guides/<tool>.ts.
// ─────────────────────────────────────────────────────────────────────────

const CSS = `
  .tg { background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 12px; color: var(--qh-text); }
  .tg > summary { list-style: none; cursor: pointer; min-height: 56px; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .tg > summary::-webkit-details-marker { display: none; }
  .tg > summary::after { content: '▾'; color: var(--qh-muted); transition: transform .2s ease; flex: none; }
  .tg[open] > summary::after { transform: rotate(180deg); }
  .tg > summary:focus-visible { outline: 2px solid var(--qh-gold); outline-offset: -2px; border-radius: 12px; }
  .tg-sum { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
  .tg-sum h2 { margin: 0; font-size: 16px; font-weight: 700; color: var(--qh-text); }
  .tg-sum span { font-size: 13px; color: var(--qh-muted); }
  .tg-body { padding: 4px 28px 24px; border-top: 1px solid var(--qh-border); font-size: 15px; line-height: 1.75; }
  .tg h3 { margin: 22px 0 8px; font-size: 16px; font-weight: 700; color: var(--qh-text); }
  .tg p { margin: 0 0 10px; color: color-mix(in srgb, var(--qh-text) 84%, var(--qh-bg)); }
  .tg ul { list-style: disc; margin: 0 0 10px; padding-inline-start: 20px; color: color-mix(in srgb, var(--qh-text) 84%, var(--qh-bg)); }
  .tg li { margin-bottom: 6px; }
  .tg-tbl { overflow-x: auto; margin: 4px 0 12px; }
  .tg table { border-collapse: collapse; font-size: 14px; min-width: 100%; }
  .tg th, .tg td { text-align: start; padding: 7px 12px; border-bottom: 1px solid var(--qh-border); vertical-align: top; }
  .tg th { font-weight: 600; color: var(--qh-muted); font-size: 13px; background: var(--qh-surface2); }
  .tg td:first-child { font-weight: 600; }
  .tg td { white-space: nowrap; }
  .tg-refs { margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--qh-border); font-size: 13px; color: var(--qh-muted); }
  .tg-refs h3 { margin: 0 0 6px; font-size: 13px; color: var(--qh-muted); text-transform: none; }
  .tg-refs ul { color: var(--qh-muted); }
  @media (max-width: 760px) { .tg > summary { padding: 10px 16px; } .tg-body { padding: 4px 16px 18px; font-size: 14.5px; } .tg th, .tg td { padding: 6px 8px; } }
`

function Block({ b }: { b: GuideBlock }) {
  if ('p' in b) return <p>{b.p}</p>
  if ('list' in b) return <ul>{b.list.map((x, i) => <li key={i}>{x}</li>)}</ul>
  const [head, ...rows] = b.table
  return (
    <div className="tg-tbl">
      <table>
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export default function ToolGuide({ guide, lang }: { guide: Guide; lang: string }) {
  const g = lang === 'ar' ? guide.ar : guide.en
  return (
    <details className="tg">
      <style>{CSS}</style>
      <summary>
        <span className="tg-sum">
          <h2>{g.title}</h2>
          <span>{lang === 'ar' ? 'طريقة الحساب · مثال محلول · المراجع' : 'How it is calculated · worked example · references'}</span>
        </span>
      </summary>
      <div className="tg-body">
        {g.sections.map(s => (
          <div key={s.h}>
            <h3>{s.h}</h3>
            {s.blocks.map((b, i) => <Block key={i} b={b} />)}
          </div>
        ))}
        <div className="tg-refs">
          <h3>{lang === 'ar' ? 'المراجع' : 'References'}</h3>
          <ul>{g.references.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      </div>
    </details>
  )
}
