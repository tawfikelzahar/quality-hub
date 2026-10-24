'use client'

// ─────────────────────────────────────────────────────────────────────────
// One stylesheet for every tool page (SPC, I-MR, X̄-R, X̄-S, …): layout,
// verdict cards, number cards, export row, data grid, help panel, phone tabs
// and action bar. Change a rule here and every tool follows.
// ─────────────────────────────────────────────────────────────────────────

const CSS = `
  .tl-shell { display: flex; flex: 1; min-height: 0; align-items: stretch; }
  .tl-main { flex: 1; min-width: 0; padding: 24px 28px 48px; display: flex; flex-direction: column; gap: 20px; }
  .tl-head h1 { margin: 0 0 4px; font-size: 26px; font-weight: 700; letter-spacing: -0.3px; }
  .tl-head p { margin: 0; font-size: 14px; line-height: 1.7; color: color-mix(in srgb, var(--qh-text) 76%, var(--qh-bg)); }
  .tl-top { display: flex; gap: 20px; align-items: flex-start; }
  .tl-setup { width: 300px; flex: none; display: flex; flex-direction: column; gap: 18px; position: sticky; top: 16px; }
  .tl-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px; }
  .tl-data { min-width: 0; }
  .tl-results { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .tl-results-head { display: flex; flex-direction: column; gap: 10px; }
  .tl-verdicts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 12px; }
  .tl-verdict { display: flex; gap: 14px; align-items: flex-start; border-radius: 12px; padding: 16px 18px; }
  .tl-verdict-icon { width: 36px; height: 36px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; }
  .tl-more { background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 12px; }
  .tl-more > summary { list-style: none; cursor: pointer; min-height: 50px; padding: 0 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-weight: 700; font-size: 15px; }
  .tl-more > summary::-webkit-details-marker { display: none; }
  .tl-more > summary::after { content: '▾'; color: var(--qh-muted); transition: transform .2s ease; }
  .tl-more[open] > summary::after { transform: rotate(180deg); }
  .tl-more-body { padding: 0 18px 18px; display: flex; flex-direction: column; gap: 16px; }
  .tl-cells { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 6px; max-height: 280px; overflow-y: auto; padding: 2px; }
  .tl-cell { position: relative; display: flex; align-items: center; gap: 6px; background: var(--qh-bg); border: 1px solid var(--qh-border); border-radius: 7px; padding: 0 8px; min-height: 38px; }
  .tl-cell:focus-within { border-color: var(--qh-accent); }
  .tl-cell-n { font-size: 11px; color: var(--qh-muted); min-width: 16px; }
  .tl-cell input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--qh-text); font: 600 14px ui-monospace, 'SF Mono', Menlo, monospace; text-align: end; padding: 8px 0; -moz-appearance: textfield; }
  .tl-cell input::-webkit-outer-spin-button, .tl-cell input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .tl-cell-x { position: absolute; top: -7px; inset-inline-end: -7px; width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--qh-border); background: var(--qh-surface); color: var(--qh-muted); font-size: 10px; line-height: 1; cursor: pointer; display: none; padding: 0; }
  .tl-cell:hover .tl-cell-x, .tl-cell:focus-within .tl-cell-x { display: block; }
  @media (hover: none) { .tl-cell-x { display: block; } }
  .tl-paste { margin-top: 10px; border: 1px dashed var(--qh-border); border-radius: 8px; padding: 12px; text-align: center; font-size: 13px; color: var(--qh-muted); }
  .tl-results-head { gap: 12px; }
  .tl-chip { font-size: 12px; color: var(--qh-muted); border: 1px solid var(--qh-border); border-radius: 999px; padding: 3px 10px; }
  .tl-chip-warn { color: var(--qh-amber); background: color-mix(in srgb, var(--qh-amber) 10%, transparent); border-color: color-mix(in srgb, var(--qh-amber) 45%, transparent); font-size: 13px; padding: 5px 12px; border-radius: 8px; line-height: 1.5; }
  .tl-chip-warn b { font-weight: 700; }
  .tl-exports { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .tl-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px 20px; }
  .tl-head-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .tl-head .tl-route { display: flex; gap: 8px; align-items: baseline; margin-top: 8px; font-size: 13px; color: var(--qh-muted); }
  .tl-route a, .tl-hint-route a { color: var(--qh-accent); font-weight: 600; text-decoration: none; white-space: nowrap; }
  .tl-route a:hover, .tl-hint-route a:hover { text-decoration: underline; }
  .tl-hint-route { color: var(--qh-amber); }
  .tl-head-actions .tl-xbtn span { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid currentColor; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; }
  .tl-help-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(5,10,20,.55); display: flex; justify-content: flex-end; }
  .tl-help { width: min(440px, 100%); height: 100%; overflow-y: auto; box-sizing: border-box; padding: 22px 22px 32px; background: var(--qh-bg); border-inline-start: 1px solid var(--qh-border); box-shadow: -20px 0 60px rgba(0,0,0,.25); }
  .tl-help-steps { margin: 14px 0 0; padding: 0; list-style: none; counter-reset: s; display: flex; flex-direction: column; gap: 12px; }
  .tl-help-steps li { counter-increment: s; position: relative; padding-inline-start: 38px; font-size: 14px; line-height: 1.7; }
  .tl-help-steps li::before { content: counter(s); position: absolute; inset-inline-start: 0; top: 0; width: 26px; height: 26px; border-radius: 50%; background: var(--qh-surface2); color: var(--qh-gold); font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; }
  .tl-help-steps b { display: block; }
  .tl-help-steps span { color: color-mix(in srgb, var(--qh-text) 78%, var(--qh-bg)); }
  .tl-help-box { margin-top: 16px; background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 12px; padding: 14px 16px; font-size: 14px; line-height: 1.7; }
  .tl-help-box ul { margin: 6px 0; padding-inline-start: 18px; }
  .tl-help-box p { margin: 6px 0 0; font-size: 13px; color: var(--qh-muted); }
  .tl-xbtn { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--qh-border); background: transparent; color: var(--qh-text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .tl-xbtn:hover:not(:disabled) { background: var(--qh-surface); }
  .tl-xbtn:disabled { opacity: .5; cursor: default; }
  .tl-xbtn-pro { border-color: color-mix(in srgb, var(--qh-gold) 70%, transparent); color: var(--qh-gold); }
  .tl-pro { font-size: 10px; font-weight: 800; letter-spacing: .5px; color: var(--qh-onGold); background: var(--qh-gold); border-radius: 4px; padding: 1px 5px; }
  .tl-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
  .tl-kpi { background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 10px; padding: 10px 12px; min-width: 0; }
  .tl-kpi span { display: block; font-size: 12px; color: var(--qh-muted); }
  .tl-kpi b { display: block; font: 600 19px ui-monospace, 'SF Mono', Menlo, monospace; font-variant-numeric: tabular-nums; margin-top: 2px; direction: ltr; text-align: start; }
  [dir="rtl"] .tl-kpi b { text-align: end; }
  .tl-card { background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 12px; padding: 20px; }
  .tl-label { font-size: 13px; font-weight: 600; color: var(--qh-text); margin-bottom: 8px; }
  .tl-hint { font-size: 11px; color: var(--qh-muted); margin-top: 6px; line-height: 1.5; }
  .tl-input, .tl-field input { width: 100%; box-sizing: border-box; background: color-mix(in srgb, var(--qh-bg) 70%, var(--qh-surface)); border: 1px solid var(--qh-border); border-radius: 7px; color: var(--qh-text); padding: 8px 10px; font: 500 14px ui-monospace, 'SF Mono', Menlo, monospace; outline: none; }
  .tl-input:focus, .tl-field input:focus { border-color: var(--qh-accent); }
  .tl-spec { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .tl-field { display: block; min-width: 0; }
  .tl-field span { display: block; font-size: 11px; color: var(--qh-muted); margin-bottom: 3px; }
  .tl-analyze { width: 100%; min-height: 46px; border: 0; border-radius: 10px; background: var(--qh-accent); color: var(--qh-onAccent); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
  .tl-analyze:disabled { opacity: .6; cursor: default; }
  .tl-add { border-style: dashed; border-color: var(--qh-accent); color: var(--qh-accent); background: color-mix(in srgb, var(--qh-accent) 7%, transparent); }
  .tl-xbtn-sm { min-height: 32px; padding: 0 12px; font-size: 12px; }
  .tl-error { border: 1px solid var(--qh-danger); color: var(--qh-danger); background: color-mix(in srgb, var(--qh-danger) 6%, transparent); border-radius: 10px; padding: 12px 14px; font-size: 13px; }
  .tl-empty { text-align: center; padding: 48px 20px; color: var(--qh-muted); }
  .tl-sg-wrap { overflow-x: auto; max-height: 340px; overflow-y: auto; border: 1px solid var(--qh-border); border-radius: 8px; }
  .tl-sg { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tl-sg th { position: sticky; top: 0; background: var(--qh-surface2); color: var(--qh-muted); font-weight: 600; font-size: 12px; padding: 6px 8px; text-align: center; }
  .tl-sg td { border-top: 1px solid var(--qh-border); padding: 4px; text-align: center; }
  .tl-sg-n { color: var(--qh-muted); font-size: 11px; width: 34px; }
  .tl-sg input { width: 100%; min-width: 64px; box-sizing: border-box; background: transparent; border: 1px solid transparent; border-radius: 6px; color: var(--qh-text); padding: 6px 6px; font: 600 13px ui-monospace, 'SF Mono', Menlo, monospace; text-align: end; outline: none; -moz-appearance: textfield; }
  .tl-sg input:focus { border-color: var(--qh-accent); background: var(--qh-bg); }
  .tl-sg input::-webkit-outer-spin-button, .tl-sg input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .tl-sg-x { background: transparent; border: 0; color: var(--qh-muted); cursor: pointer; font-size: 11px; padding: 4px 6px; border-radius: 6px; }
  .tl-sg-x:hover { color: var(--qh-danger); }
  .tl-chart { background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 12px; padding: 18px 20px; }
  .tl-chart h3 { margin: 0 0 4px; font-size: 16px; font-weight: 700; }
  .tl-chart .tl-chart-sub { color: var(--qh-muted); font-size: 12px; margin-bottom: 14px; }
  .tl-chart-inner { height: 340px; position: relative; }
  .tl-violation { background: var(--qh-surface2); border: 1px solid var(--qh-border); border-radius: 10px; padding: 10px 12px; margin-top: 8px; }
  .tl-tabs { display: none; }
  .tl-bar { display: none; }
  @media (max-width: 900px) and (min-width: 769px) {
    .tl-setup { width: 260px; }
  }
  @media (max-width: 768px) {
    .tl-main { padding: 14px 14px 24px; gap: 14px; }
    .tl-head h1 { font-size: 22px; }
    .tl-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 10px; }
    .tl-tabs button { min-height: 42px; border: 0; border-radius: 7px; background: transparent; color: var(--qh-muted); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
    .tl-tabs button[aria-selected="true"] { background: var(--qh-accent); color: var(--qh-onAccent); font-weight: 700; }
    .tl-panel[data-active="false"] { display: none !important; }
    .tl-top { flex-direction: column; gap: 14px; }
    .tl-setup { width: auto; position: static; }
    .tl-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tl-chart-inner { height: 260px; }
    .tl-card { padding: 16px; }
    .tl-setup-analyze { display: none; }
    .tl-col { width: 100%; gap: 14px; }
    .tl-bar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; position: sticky; bottom: 0; z-index: 20; padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px)); background: var(--qh-bg); border-top: 1px solid var(--qh-border); }
    .tl-bar button { min-height: 48px; border-radius: 10px; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
    .tl-bar .tl-bar-primary { background: var(--qh-accent); color: var(--qh-onAccent); border: 0; }
    .tl-bar .tl-bar-ghost { background: transparent; color: var(--qh-text); border: 1px solid var(--qh-border); }
    .tl-bar .tl-bar-wide { grid-column: 1 / -1; }
  }
`

export default function ToolStyles() {
  return <style>{CSS}</style>
}
