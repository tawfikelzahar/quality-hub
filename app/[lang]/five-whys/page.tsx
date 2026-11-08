'use client';

// ─────────────────────────────────────────────────────────────────────────
// 5 Whys root cause analysis. No calculation: the page edits the analysis
// (lib/fiveWhys/model.ts), reviews its structure as the person writes, and
// exports it. Free to fill in; CSV / PNG with an account; Excel, PDF and
// Save with Pro — the same split as every tool.
// ─────────────────────────────────────────────────────────────────────────

import ToolGuide from '@/components/tool/ToolGuide';
import { FIVE_WHYS_GUIDE } from '@/lib/guides/fiveWhys';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSharedStyles, usePersistedTheme, COLORS, tint } from '@/lib/theme';
import Nav from '@/components/Nav';
import ToolSidebar from '@/components/ToolSidebar';
import ToolStyles from '@/components/tool/ToolStyles';
import { ToolHeader, HelpPanel, ExportRow, useCompactSave } from '@/components/tool/ToolParts';
import SaveAnalysisButton from '@/components/SaveAnalysisButton';
import { useSubscription } from '@/lib/useSubscription';
import { goToLogin, goToPricing } from '@/lib/exportGate';
import { useLanguage } from '@/lib/i18n/context';
import type { TKey } from '@/lib/i18n/translations';
import { createReport, nowStamp } from '@/lib/excelReport';
import { createReport as createPdfReport, twoColumnTables, dataTable, calloutBox, finalizeReport, REPORT_COLORS, type KVRow } from '@/lib/pdf/reportDesign';
import {
  EMPTY, example, flatten, newId, paths, review, rootCauses,
  type Action, type FiveWhys, type ReviewItem, type TrackId, type WhyNode,
} from '@/lib/fiveWhys/model';

const DRAFT_KEY = 'qh-fivewhys-draft';
const TRACK_EN: Record<TrackId, string> = { occ: 'Why did it happen? (Occurrence)', det: 'Why was it not detected? (Detection)' };
const TRACK_SHORT_EN: Record<TrackId, string> = { occ: 'Occurrence', det: 'Detection' };

// ── Tree edits (pure) ──────────────────────────────────────────────────────
function mapTree(nodes: WhyNode[], fn: (n: WhyNode) => WhyNode | null): WhyNode[] {
  const out: WhyNode[] = [];
  for (const n of nodes) {
    const m = fn(n);
    if (m) out.push({ ...m, children: mapTree(m.children, fn) });
  }
  return out;
}
function insertSibling(nodes: WhyNode[], id: string, fresh: WhyNode): WhyNode[] {
  const i = nodes.findIndex(n => n.id === id);
  if (i >= 0) return [...nodes.slice(0, i + 1), fresh, ...nodes.slice(i + 1)];
  return nodes.map(n => ({ ...n, children: insertSibling(n.children, id, fresh) }));
}
const blank = (): WhyNode => ({ id: newId(), text: '', children: [] });

interface NodeEd {
  t: (k: TKey) => string
  focusId: string | null
  setText: (track: TrackId, id: string, text: string) => void
  addChild: (track: TrackId, id: string) => void
  addSibling: (track: TrackId, id: string) => void
  toggleRoot: (track: TrackId, id: string) => void
  remove: (track: TrackId, id: string) => void
}

// One answer in a chain, with its own children. Kept outside the page
// component so typing never remounts the textarea.
function NodeView({ node, level, track, ed }: { node: WhyNode; level: number; track: TrackId; ed: NodeEd }) {
  const { t, focusId, setText, addChild, addSibling, toggleRoot, remove } = ed;
  const leaf = node.children.length === 0;
  return (
    <li className="fw-li">
      <div className={`fw-node${node.root ? ' is-root' : ''}`}>
        <span className="fw-badge">{node.root ? t('fw_mark_root') : t('fw_why_n').replace('{n}', String(level))}</span>
        <textarea
          className="fw-text"
          rows={1}
          value={node.text}
          placeholder={t('fw_answer_ph')}
          aria-label={t('fw_why_n').replace('{n}', String(level))}
          dir="auto"
          autoFocus={focusId === node.id}
          onChange={e => setText(track, node.id, e.target.value)}
        />
        <div className="fw-tools">
          <button type="button" className="fw-btn" onClick={() => addChild(track, node.id)}>{t('fw_add_why')}</button>
          <button type="button" className="fw-btn" onClick={() => addSibling(track, node.id)}>{t('fw_add_sibling')}</button>
          <button type="button" className={`fw-btn fw-rootbtn${node.root ? ' on' : ''}`} aria-pressed={!!node.root} disabled={!leaf} title={leaf ? '' : t('fw_root_hint')} onClick={() => toggleRoot(track, node.id)}>
            {node.root ? t('fw_is_root') : t('fw_mark_root')}
          </button>
          <button type="button" className="fw-btn fw-x" aria-label={t('fw_remove')} onClick={() => remove(track, node.id)}>✕</button>
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="fw-ul">
          {node.children.map(ch => <NodeView key={ch.id} node={ch} level={level + 1} track={track} ed={ed} />)}
        </ul>
      )}
    </li>
  );
}


export default function FiveWhysPage() {
  const [theme, setTheme] = usePersistedTheme();
  const { t, lang } = useLanguage();
  const c = COLORS[theme];
  const s = getSharedStyles(theme);
  const { isPro, isLoggedIn } = useSubscription();
  const compactSave = useCompactSave();

  const [a, setA] = useState<FiveWhys>(EMPTY);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loadedProjectName, setLoadedProjectName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const loaded = useRef(false);

  // A saved project (?id=…) opens as saved; otherwise the last draft in this browser
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) {
      fetch(`/api/saved-analyses/${id}`)
        .then(res => (res.ok ? res.json() : Promise.reject()))
        .then(({ analysis }) => {
          setA({ ...EMPTY, ...(analysis.input_data as FiveWhys) });
          setLoadedProjectName(analysis.name as string);
        })
        .catch(() => setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.'))
        .finally(() => { loaded.current = true; });
      return;
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setA({ ...EMPTY, ...(JSON.parse(raw) as FiveWhys) });
    } catch { /* no storage: start empty */ }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Keep a draft in this browser so a closed tab loses nothing
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(a)); } catch { /* ignore */ }
  }, [a]);

  // ── Edits ─────────────────────────────────────────────────────────────
  const setProblem = (k: keyof FiveWhys['problem'], v: string) => setA(p => ({ ...p, problem: { ...p.problem, [k]: v } }));
  const editTrack = (track: TrackId, fn: (nodes: WhyNode[]) => WhyNode[]) => setA(p => ({ ...p, [track]: fn(p[track]) }));
  const setText = (track: TrackId, id: string, text: string) => editTrack(track, ns => mapTree(ns, n => (n.id === id ? { ...n, text } : n)));
  const addFirst = (track: TrackId) => { const f = blank(); setFocusId(f.id); editTrack(track, ns => [...ns, f]); };
  const addChild = (track: TrackId, id: string) => {
    const f = blank(); setFocusId(f.id);
    editTrack(track, ns => mapTree(ns, n => (n.id === id ? { ...n, root: false, children: [...n.children, f] } : n)));
  };
  const addSibling = (track: TrackId, id: string) => { const f = blank(); setFocusId(f.id); editTrack(track, ns => insertSibling(ns, id, f)); };
  const toggleRoot = (track: TrackId, id: string) => editTrack(track, ns => mapTree(ns, n => (n.id === id ? { ...n, root: !n.root } : n)));
  const remove = (track: TrackId, id: string) => editTrack(track, ns => mapTree(ns, n => (n.id === id ? null : n)));
  const setAction = (id: string, k: keyof Action, v: string) =>
    setA(p => ({ ...p, actions: { ...p.actions, [id]: { ...(p.actions[id] ?? { action: '', owner: '', due: '' }), [k]: v } } }));

  function loadExample() { setA(example(lang === 'ar' ? 'ar' : 'en')); setLoadedProjectName(''); }
  function clearAll() { if (window.confirm(t('fw_clear_confirm'))) { setA(EMPTY); setLoadedProjectName(''); } }

  // ── Derived ──────────────────────────────────────────────────────────
  const roots = useMemo(() => rootCauses(a), [a]);
  const items = useMemo(() => review(a), [a]);
  const tracks: TrackId[] = a.detOn ? ['occ', 'det'] : ['occ'];
  const trackName = (tr: TrackId) => t(tr === 'occ' ? 'fw_track_occ' : 'fw_track_det');
  const hasContent = !!a.problem.statement.trim() || a.occ.length > 0;
  const actionsDone = roots.filter(r => a.actions[r.node.id]?.action.trim()).length;

  function itemText(it: ReviewItem): string {
    switch (it.kind) {
      case 'problem': return t('fw_chk_problem');
      case 'empty': return t('fw_chk_empty');
      case 'det_empty': return t('fw_chk_det_empty');
      case 'blame': return t('fw_chk_blame').replace('{track}', trackName(it.track)).replace('{n}', String(it.level)).replace('{word}', it.word);
      default: return t(`fw_chk_${it.kind}` as TKey).replace('{track}', trackName(it.track)).replace('{n}', String(it.level));
    }
  }
  const itemEn = (it: ReviewItem): string => {
    const tr = 'track' in it ? TRACK_SHORT_EN[it.track] : '';
    const n = 'level' in it ? it.level : 0;
    switch (it.kind) {
      case 'problem': return 'The problem is not described.';
      case 'empty': return 'The occurrence chain is empty.';
      case 'det_empty': return 'The detection chain is empty.';
      case 'blank': return `${tr}: Why ${n} is empty.`;
      case 'open': return `${tr}: the branch ending at Why ${n} has no root cause.`;
      case 'shallow': return `${tr}: the root cause is at Why ${n}, which is often still a symptom.`;
      case 'deep': return `${tr}: the branch goes to Why ${n}.`;
      case 'blame': return `${tr}, Why ${n}: the answer blames a person ("${it.word}").`;
      case 'no_action': return `${tr}: the root cause at Why ${n} has no action.`;
      case 'action_owner': return `${tr}: the action for Why ${n} has no owner or due date.`;
    }
  };

  // ── Exports ──────────────────────────────────────────────────────────
  const fileBase = '5-whys';
  const problemRows = (): KVRow[] => [
    ['Problem', a.problem.statement || '—'],
    ['Where', a.problem.where || '—'],
    ['When', a.problem.when || '—'],
    ['How many / how often', a.problem.extent || '—'],
  ];

  function exportCSV() {
    if (!isLoggedIn) { goToLogin('five_whys', 'csv'); return; }
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = ['Section,Item,Value'];
    problemRows().forEach(([k, v]) => lines.push(['Problem', q(k), q(v)].join(',')));
    lines.push('', 'Track,Why,Answer,Root cause,Action,Owner,Due date');
    for (const tr of tracks) {
      for (const { node, level } of flatten(a[tr])) {
        const act = node.root ? a.actions[node.id] : undefined;
        lines.push([TRACK_SHORT_EN[tr], level, q(node.text), node.root ? 'yes' : '', q(act?.action ?? ''), q(act?.owner ?? ''), act?.due ?? ''].join(','));
      }
    }
    const blob = new Blob(['﻿', lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url; el.download = `${fileBase}.csv`; el.click();
    URL.revokeObjectURL(url);
  }

  // Picture of the chains (free with an account); watermark for free accounts like the charts
  function exportPNG() {
    if (!isLoggedIn) { goToLogin('five_whys', 'png'); return; }
    const W = 1100, pad = 32, indent = 34, boxW = (lvl: number) => W - pad * 2 - (lvl - 1) * indent;
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const font = '15px system-ui, "Segoe UI", Tahoma, sans-serif';
    ctx.font = font;
    const wrap = (text: string, width: number) => {
      const words = (text || '—').split(/\s+/);
      const out: string[] = [];
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (ctx.measureText(next).width > width && line) { out.push(line); line = w; } else line = next;
      }
      if (line) out.push(line);
      return out;
    };
    type Row = { kind: 'h' | 'n' | 'p'; text: string; level: number; lines: string[]; root?: boolean; h: number };
    const rows: Row[] = [];
    const pLines = wrap(a.problem.statement, W - pad * 2 - 24);
    rows.push({ kind: 'p', text: '', level: 1, lines: pLines, h: 30 + pLines.length * 21 });
    for (const tr of tracks) {
      rows.push({ kind: 'h', text: t(tr === 'occ' ? 'fw_occ_t' : 'fw_det_t'), level: 1, lines: [], h: 44 });
      for (const { node, level } of flatten(a[tr])) {
        const lines = wrap(node.text, boxW(level) - 110);
        rows.push({ kind: 'n', text: '', level, lines, root: node.root, h: Math.max(44, 18 + lines.length * 21) + 10 });
      }
    }
    const H = pad * 2 + 50 + rows.reduce((sum, r) => sum + r.h, 0) + 30;
    const scale = 2;
    cv.width = W * scale; cv.height = H * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.direction = dir;
    const X = (x: number, w = 0) => (dir === 'rtl' ? W - x - w : x);
    const tx = (x: number) => (dir === 'rtl' ? W - x : x);
    ctx.textAlign = 'start';
    ctx.fillStyle = '#0B1F3F'; ctx.font = 'bold 22px system-ui, "Segoe UI", Tahoma, sans-serif';
    ctx.fillText(t('fw_title'), tx(pad), pad + 18);
    let y = pad + 50;
    for (const r of rows) {
      if (r.kind === 'p') {
        ctx.fillStyle = '#EEF2F8'; ctx.fillRect(X(pad, W - pad * 2), y, W - pad * 2, r.h - 8);
        ctx.fillStyle = '#B8944E'; ctx.fillRect(dir === 'rtl' ? W - pad - 4 : pad, y, 4, r.h - 8);
        ctx.fillStyle = '#0B1F3F'; ctx.font = 'bold 15px system-ui, "Segoe UI", Tahoma, sans-serif';
        r.lines.forEach((l, i) => ctx.fillText(l, tx(pad + 16), y + 26 + i * 21));
      } else if (r.kind === 'h') {
        ctx.fillStyle = '#0B1F3F'; ctx.font = 'bold 17px system-ui, "Segoe UI", Tahoma, sans-serif';
        ctx.fillText(r.text, tx(pad), y + 28);
      } else {
        const x = pad + (r.level - 1) * indent, w = boxW(r.level), h = r.h - 10;
        if (r.level > 1) {
          ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 1.5; ctx.beginPath();
          const lx = tx(x - indent / 2);
          ctx.moveTo(lx, y - 10); ctx.lineTo(lx, y + h / 2); ctx.lineTo(tx(x), y + h / 2); ctx.stroke();
        }
        ctx.fillStyle = r.root ? '#E8F5EC' : '#F8FAFC'; ctx.fillRect(X(x, w), y, w, h);
        ctx.strokeStyle = r.root ? '#1A7F4B' : '#E2E8F0'; ctx.lineWidth = r.root ? 2 : 1; ctx.strokeRect(X(x, w) + 0.5, y + 0.5, w - 1, h - 1);
        ctx.fillStyle = r.root ? '#1A7F4B' : '#64748B'; ctx.font = 'bold 13px system-ui, "Segoe UI", Tahoma, sans-serif';
        ctx.fillText(r.root ? t('fw_mark_root') : t('fw_why_n').replace('{n}', String(r.level)), tx(x + 12), y + 26);
        ctx.fillStyle = '#1E293B'; ctx.font = font;
        r.lines.forEach((l, i) => ctx.fillText(l, tx(x + 104), y + 26 + i * 21));
      }
      y += r.h;
    }
    if (!isPro) {
      ctx.fillStyle = 'rgba(11,31,63,0.55)'; ctx.font = '12px system-ui, sans-serif'; ctx.direction = 'ltr'; ctx.textAlign = 'center';
      ctx.fillText('mizanquality.com', W / 2, H - 14);
    }
    const el = document.createElement('a');
    el.href = cv.toDataURL('image/png'); el.download = `${fileBase}.png`; el.click();
  }

  async function exportExcel() {
    if (!isPro) { goToPricing('five_whys', 'excel'); return; }
    const report = createReport({ toolName: '5 Whys' });
    const sh = report.addSheet('5 Whys');
    sh.titleBand('5 Whys Root Cause Analysis', `${roots.length} root cause(s)   |   ${actionsDone} action(s)`);
    sh.metaStrip([['Generated on', nowStamp()]]);
    sh.sectionHeading('Problem');
    sh.table({ headers: [{ header: 'Item', key: 'k', align: 'left', width: 24 }, { header: 'Value', key: 'v', align: 'left', width: 80 }], rows: problemRows().map(([k, v]) => ({ k, v })) });
    for (const tr of tracks) {
      sh.sectionHeading(TRACK_EN[tr]);
      const f = flatten(a[tr]);
      sh.table({
        headers: [{ header: 'Why', key: 'w', align: 'left', width: 10 }, { header: 'Answer', key: 'x', align: 'left', width: 84 }, { header: 'Root cause', key: 'r', align: 'left', width: 12 }],
        rows: f.map(({ node, level }) => ({ w: `${'  '.repeat(level - 1)}Why ${level}`, x: node.text, r: node.root ? 'Yes' : '' })),
        rowTones: f.map(({ node }) => (node.root ? ('good' as const) : undefined)),
      });
    }
    sh.sectionHeading('Actions');
    sh.table({
      headers: [{ header: 'Track', key: 'tr', align: 'left', width: 12 }, { header: 'Root cause', key: 'rc', align: 'left', width: 40 }, { header: 'Action', key: 'ac', align: 'left', width: 44 }, { header: 'Owner', key: 'ow', align: 'left', width: 18 }, { header: 'Due date', key: 'du', align: 'left', width: 12 }],
      rows: roots.map(r => ({ tr: TRACK_SHORT_EN[r.track], rc: r.node.text, ac: a.actions[r.node.id]?.action ?? '', ow: a.actions[r.node.id]?.owner ?? '', du: a.actions[r.node.id]?.due ?? '' })),
    });
    if (items.length) {
      sh.sectionHeading('Open points');
      items.forEach(it => sh.note(itemEn(it), 'warning'));
    }
    await report.download(`${fileBase}.xlsx`);
  }

  function exportPDF() {
    if (!isPro) { goToPricing('five_whys', 'pdf'); return; }
    const ctx = createPdfReport('5 Whys Root Cause Analysis', 'five_whys');
    const pr = problemRows();
    twoColumnTables(ctx, 'Problem', pr.slice(0, 2), 'Scope', pr.slice(2));
    const full = ctx.pageWidth - ctx.margin * 2;
    for (const tr of tracks) {
      const f = flatten(a[tr]);
      if (!f.length) continue;
      dataTable(ctx, TRACK_EN[tr], [{ header: 'WHY', width: 70 }, { header: 'ANSWER', width: full - 150 }, { header: 'ROOT CAUSE', width: 80 }],
        f.map(({ node, level }) => [`${level > 1 ? '- '.repeat(level - 1) : ''}Why ${level}`, node.text || '—', node.root ? 'Yes' : '']),
        { cellColors: f.map(({ node }) => (node.root ? [REPORT_COLORS.good, REPORT_COLORS.good, REPORT_COLORS.good] : [null, null, null])), allowSplit: true });
    }
    if (roots.length) {
      dataTable(ctx, 'Actions', [{ header: 'ROOT CAUSE', width: full * 0.34 }, { header: 'ACTION', width: full * 0.36 }, { header: 'OWNER', width: full * 0.16 }, { header: 'DUE', width: full * 0.14 }],
        roots.map(r => [`${TRACK_SHORT_EN[r.track]}: ${r.node.text}`, a.actions[r.node.id]?.action || '—', a.actions[r.node.id]?.owner || '—', a.actions[r.node.id]?.due || '—']), { allowSplit: true });
    }
    calloutBox(ctx, items.length ? `Open points: ${items.map(itemEn).join(' ')}` : 'Every branch ends in a root cause and every root cause has an action, an owner and a due date.', items.length ? 'warn' : 'good');
    finalizeReport(ctx);
    ctx.pdf.save(`${fileBase}.pdf`);
  }

  // ── Rendering ────────────────────────────────────────────────────────
  const arrow = lang === 'ar' ? '←' : '→';
  const ed: NodeEd = { t, focusId, setText, addChild, addSibling, toggleRoot, remove };
  const helpSteps = [1, 2, 3, 4].map(i => ({ t: t(`fw_help_s${i}_t` as TKey), d: t(`fw_help_s${i}_d` as TKey) }));

  return (
    <div style={s.page}>
      <ToolStyles />
      <style>{`
        .fw-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .fw-p-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
        .fw-card-h { font-weight: 700; font-size: 16px; margin: 0 0 2px; }
        .fw-card-s { font-size: 12.5px; color: var(--qh-muted); margin: 0 0 12px; line-height: 1.6; }
        .fw-in, .fw-text { width: 100%; box-sizing: border-box; background: color-mix(in srgb, var(--qh-bg) 70%, var(--qh-surface)); border: 1px solid var(--qh-border); border-radius: 8px; color: var(--qh-text); padding: 8px 10px; font: 500 14px/1.6 inherit; font-family: inherit; outline: none; resize: none; }
        .fw-in:focus, .fw-text:focus { border-color: var(--qh-accent); }
        .fw-text { field-sizing: content; min-height: 38px; }
        textarea.fw-in { field-sizing: content; min-height: 60px; font-size: 15px; font-weight: 600; }
        .fw-lab { display: block; font-size: 11.5px; color: var(--qh-muted); margin-bottom: 4px; }
        .fw-ul { list-style: none; margin: 0; padding: 0; }
        .fw-ul .fw-ul { margin-inline-start: 18px; padding-inline-start: 14px; border-inline-start: 2px solid var(--qh-border); }
        .fw-li { margin-top: 10px; }
        .fw-node { background: var(--qh-surface2); border: 1px solid var(--qh-border); border-radius: 10px; padding: 10px; }
        .fw-node.is-root { border-color: var(--qh-good); background: color-mix(in srgb, var(--qh-good) 9%, var(--qh-surface)); box-shadow: 0 0 0 1px var(--qh-good) inset; }
        .fw-badge { display: inline-block; font-size: 11.5px; font-weight: 700; color: var(--qh-muted); margin-bottom: 6px; letter-spacing: .02em; }
        .is-root .fw-badge { color: var(--qh-good); }
        .fw-tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .fw-btn { background: transparent; border: 1px solid var(--qh-border); color: var(--qh-text); border-radius: 7px; padding: 4px 10px; font: 600 12px inherit; font-family: inherit; cursor: pointer; }
        .fw-btn:hover:not(:disabled) { border-color: var(--qh-accent); }
        .fw-btn:disabled { opacity: .4; cursor: not-allowed; }
        .fw-rootbtn.on { border-color: var(--qh-good); color: var(--qh-good); }
        .fw-x { margin-inline-start: auto; color: var(--qh-muted); }
        .fw-first { margin-top: 4px; }
        .fw-check { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; line-height: 1.7; padding: 8px 0; border-top: 1px solid var(--qh-border); }
        .fw-check:first-of-type { border-top: 0; }
        .fw-dot { width: 22px; height: 22px; border-radius: 50%; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; margin-top: 1px; }
        .fw-chain { border: 1px solid var(--qh-border); border-radius: 10px; padding: 10px 12px; margin-top: 10px; font-size: 13.5px; line-height: 1.75; }
        .fw-chain b { color: var(--qh-good); }
        .fw-tf { color: var(--qh-gold); font-weight: 700; font-size: 12px; margin: 0 4px; }
        .fw-act { width: 100%; border-collapse: collapse; font-size: 13px; }
        .fw-act th { text-align: start; font-size: 11.5px; color: var(--qh-muted); font-weight: 600; padding: 6px 6px; border-bottom: 1px solid var(--qh-border); }
        .fw-act td { padding: 6px; vertical-align: top; border-bottom: 1px solid var(--qh-border); }
        .fw-act td.cause { font-size: 13px; line-height: 1.6; min-width: 180px; }
        .fw-act .tag { display: inline-block; font-size: 10.5px; font-weight: 700; color: var(--qh-muted); margin-bottom: 2px; }
        .fw-act .fw-in { padding: 6px 8px; font-size: 13px; }
        .fw-topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
        .fw-sum { font-size: 13px; color: var(--qh-muted); }
        .fw-det-on { display: flex; gap: 8px; align-items: center; font-size: 13px; margin-top: 12px; cursor: pointer; }
        @media (max-width: 980px) { .fw-grid { grid-template-columns: 1fr; } }
        @media (max-width: 640px) { .fw-p-grid { grid-template-columns: 1fr; } .fw-act thead { display: none; } .fw-act tr { display: block; border-bottom: 1px solid var(--qh-border); padding: 6px 0; } .fw-act td { display: block; border: 0; padding: 4px 0; } }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_fw" />

      {(loadedProjectName || loadError) && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          {loadedProjectName && (
            <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
              {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
            </div>
          )}
          {loadError && <div className="tl-error">{loadError}</div>}
        </div>
      )}

      <div className="tl-shell">
        <ToolSidebar current="/five-whys" />
        <div className="tl-main">
          <ToolHeader title={t('fw_title')} intro={t('fw_intro')} route={{ text: t('fw_route_text'), href: '/pareto', label: t('fw_route_link') }} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('fw_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('fw_help_tip')} />

          <div className="fw-topbar">
            <span className="fw-sum">{t('fw_summary').replace('{r}', String(roots.length)).replace('{a}', String(actionsDone))}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <ExportRow
                isPro={isPro}
                isLoggedIn={isLoggedIn}
                hasResult={hasContent}
                onCSV={exportCSV}
                onPNG={exportPNG}
                onExcel={exportExcel}
                onPDF={exportPDF}
                pngLabel="PNG"
                save={
                  <SaveAnalysisButton
                    theme={theme}
                    tool="five_whys"
                    defaultName={`5 Whys — ${a.problem.statement.slice(0, 40) || new Date().toLocaleDateString('en-US')}`}
                    compact={compactSave}
                    getPayload={() => (hasContent ? { input_data: a, results: { rootCauses: roots.length, actions: actionsDone, openPoints: items.length } } : null)}
                  />
                }
              />
              <button type="button" className="tl-xbtn tl-xbtn-sm" style={{ color: 'var(--qh-danger)' }} onClick={clearAll}>{t('fw_clear')}</button>
            </div>
          </div>

          {/* ── Problem ───────────────────────────────────────────────── */}
          <section className="tl-card">
            <h2 className="fw-card-h">{t('fw_problem_t')}</h2>
            <p className="fw-card-s">{t('fw_problem_sub')}</p>
            <label>
              <span className="fw-lab">{t('fw_problem')}</span>
              <textarea className="fw-in" dir="auto" value={a.problem.statement} placeholder={t('fw_problem_ph')} onChange={e => setProblem('statement', e.target.value)} />
            </label>
            <div className="fw-p-grid">
              {(['where', 'when', 'extent'] as const).map(k => (
                <label key={k}>
                  <span className="fw-lab">{t(`fw_${k}` as TKey)}</span>
                  <input className="fw-in" dir="auto" value={a.problem[k]} placeholder={t(`fw_${k}_ph` as TKey)} onChange={e => setProblem(k, e.target.value)} />
                </label>
              ))}
            </div>
            <label className="fw-det-on">
              <input type="checkbox" checked={a.detOn} onChange={e => setA(p => ({ ...p, detOn: e.target.checked }))} />
              {t('fw_det_on')}
            </label>
          </section>

          {/* ── The two chains ───────────────────────────────────────── */}
          <div className="fw-grid" style={a.detOn ? undefined : { gridTemplateColumns: '1fr' }}>
            {tracks.map(tr => (
              <section key={tr} className="tl-card" aria-label={t(tr === 'occ' ? 'fw_occ_t' : 'fw_det_t')}>
                <h2 className="fw-card-h">{t(tr === 'occ' ? 'fw_occ_t' : 'fw_det_t')}</h2>
                <p className="fw-card-s">{t(tr === 'occ' ? 'fw_occ_sub' : 'fw_det_sub')}</p>
                {a[tr].length > 0 && (
                  <ul className="fw-ul">
                    {a[tr].map(n => <NodeView key={n.id} node={n} level={1} track={tr} ed={ed} />)}
                  </ul>
                )}
                <button type="button" className="tl-xbtn tl-add fw-first" onClick={() => addFirst(tr)}>{a[tr].length ? t('fw_add_sibling') : t('fw_add_first')}</button>
                <p className="fw-card-s" style={{ marginTop: 10, marginBottom: 0 }}>{t('fw_root_hint')}</p>
              </section>
            ))}
          </div>

          {/* ── Review ───────────────────────────────────────────────── */}
          <section className="tl-card" style={{ borderColor: tint(items.length ? c.amber : c.good, 40) }}>
            <h2 className="fw-card-h">{t('fw_review_t')}</h2>
            <p className="fw-card-s">{t('fw_review_sub')}</p>
            {items.length === 0 ? (
              <div className="fw-check"><span className="fw-dot" style={{ background: tint(c.good, 18), color: c.good }}>✓</span><span>{t('fw_ok')}</span></div>
            ) : items.map((it, i) => (
              <div key={i} className="fw-check">
                <span className="fw-dot" style={{ background: tint(c.amber, 18), color: c.amber }}>!</span>
                <span>{itemText(it)}</span>
              </div>
            ))}
          </section>

          {/* ── Read it back ─────────────────────────────────────────── */}
          {roots.length > 0 && (
            <section className="tl-card">
              <h2 className="fw-card-h">{t('fw_readback_t')}</h2>
              <p className="fw-card-s">{t('fw_readback_sub')}</p>
              {tracks.flatMap(tr => paths(a[tr]).filter(p => p[p.length - 1].root).map((p, i) => (
                <div key={`${tr}${i}`} className="fw-chain" dir="auto">
                  <span className="tag" style={{ fontSize: 11, fontWeight: 700, color: c.muted }}>{trackName(tr)}</span><br />
                  <b>{p[p.length - 1].text || '—'}</b>
                  {[...p].reverse().slice(1).map(n => (
                    <span key={n.id}><span className="fw-tf">{arrow} {t('fw_therefore')}</span>{n.text || '—'}</span>
                  ))}
                  {tr === 'occ' && a.problem.statement && <span><span className="fw-tf">{arrow} {t('fw_therefore')}</span><i>{a.problem.statement}</i></span>}
                </div>
              )))}
            </section>
          )}

          {/* ── Actions ──────────────────────────────────────────────── */}
          <section className="tl-card">
            <h2 className="fw-card-h">{t('fw_actions_t')}</h2>
            <p className="fw-card-s">{t('fw_actions_sub')}</p>
            {roots.length === 0 ? (
              <div style={{ fontSize: 13, color: c.muted }}>{t('fw_actions_empty')}</div>
            ) : (
              <table className="fw-act">
                <thead>
                  <tr><th>{t('fw_col_cause')}</th><th>{t('fw_col_action')}</th><th>{t('fw_col_owner')}</th><th>{t('fw_col_due')}</th></tr>
                </thead>
                <tbody>
                  {roots.map(r => {
                    const act = a.actions[r.node.id] ?? { action: '', owner: '', due: '' };
                    return (
                      <tr key={r.node.id}>
                        <td className="cause"><span className="tag">{trackName(r.track)} · {t('fw_why_n').replace('{n}', String(r.level))}</span><br /><span dir="auto">{r.node.text || '—'}</span></td>
                        <td><textarea className="fw-in" style={{ minHeight: 38, fontWeight: 500, fontSize: 13 }} dir="auto" value={act.action} placeholder={t('fw_action_ph')} aria-label={t('fw_col_action')} onChange={e => setAction(r.node.id, 'action', e.target.value)} /></td>
                        <td><input className="fw-in" dir="auto" value={act.owner} placeholder={t('fw_owner_ph')} aria-label={t('fw_col_owner')} onChange={e => setAction(r.node.id, 'owner', e.target.value)} /></td>
                        <td><input className="fw-in" type="date" value={act.due} aria-label={t('fw_col_due')} onChange={e => setAction(r.node.id, 'due', e.target.value)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <p style={{ fontSize: 11, color: c.muted, opacity: 0.8, margin: 0 }}>{t('fw_footer')}</p>
          <ToolGuide guide={FIVE_WHYS_GUIDE} lang={lang} />
        </div>
      </div>
    </div>
  );
}
