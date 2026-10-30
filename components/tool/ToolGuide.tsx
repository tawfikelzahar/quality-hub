import type { GuideBlock, ToolGuide as Guide } from '@/lib/guides/types'

// ─────────────────────────────────────────────────────────────────────────
// "About this tool" section under a tool: what it does, how it is
// calculated, a worked example and the references. Server component (no
// state), rendered by the tool's page in the page's language and handed to
// the tool as its `guide` prop, so the text is in the HTML Google reads.
// Content lives in lib/guides/<tool>.ts.
// ─────────────────────────────────────────────────────────────────────────

const CSS = `
  .tg { background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 12px; padding: 24px 28px; color: var(--qh-text); font-size: 15px; line-height: 1.75; }
  .tg > h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: var(--qh-accent); }
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
  @media (max-width: 760px) { .tg { padding: 18px 16px; font-size: 14.5px; } .tg > h2 { font-size: 18px; } .tg th, .tg td { padding: 6px 8px; } }
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
    <section className="tg" aria-labelledby="tool-guide-title">
      <style>{CSS}</style>
      <h2 id="tool-guide-title">{g.title}</h2>
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
    </section>
  )
}
