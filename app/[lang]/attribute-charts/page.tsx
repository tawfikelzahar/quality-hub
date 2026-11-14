'use client';

// ─────────────────────────────────────────────────────────────────────────
// Attribute control charts page: p, np, c and u.
//
// The calculation runs on the server (/api/analyze, mode 'attribute' →
// lib/spc/attribute.server.ts), the same calculator SPC Engine uses and the
// one checked against specialised statistical software in
// tests/golden/attribute. This page only collects the counts, checks them,
// and draws what comes back. The cumulative chart is a running total of the
// same counts (Σ count / Σ units, or the running average for np and c), so
// its last point always equals the centre line the server returned.
// ─────────────────────────────────────────────────────────────────────────

import ToolGuide from '@/components/tool/ToolGuide';
import { takeDraft } from '@/lib/draft';
import { ATTRIBUTE_GUIDE } from '@/lib/guides/charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'chart.js/auto';
import { Chart } from 'react-chartjs-2';
import type { Chart as ChartJSInstance } from 'chart.js';
import { COLORS, getSharedStyles, usePersistedTheme, tint } from '@/lib/theme';
import Nav from '@/components/Nav';
import ToolSidebar from '@/components/ToolSidebar';
import ToolStyles from '@/components/tool/ToolStyles';
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, VerdictCards, ResultsHead, ExportRow, DataCardHead, ViolationsCard, useCompactSave, violationPointsText, type MobileTab, type ViolationItem } from '@/components/tool/ToolParts';
import { ATTRIBUTE_EXAMPLES, type AttrChartType } from '@/lib/spc/attributeExamples';
import SaveAnalysisButton from '@/components/SaveAnalysisButton';
import { useSubscription } from '@/lib/useSubscription';
import { goToLogin, goToPricing } from '@/lib/exportGate';
import { useLanguage } from '@/lib/i18n/context';
import type { TKey } from '@/lib/i18n/translations';
import { createReport, nowStamp } from '@/lib/excelReport';
import { useGridImport } from '@/lib/gridImport';
import { SheetPicker, PasteToast } from '@/components/GridImportControls';
import { watermarkOptions, watermarkLayout, withWatermarksDisabled, withPrintColors } from '@/lib/watermarkHelpers';
import {
  createReport as createPdfReport,
  calloutBox,
  twoColumnTables,
  dataTable,
  addChartImage,
  finalizeReport,
  REPORT_COLORS,
  type KVRow,
} from '@/lib/pdf/reportDesign';

type TestSet = 'assistant' | 'all';

interface Violation {
  rule: number;
  label: string;
  desc: string;
  points: number[];
  failedAt: number[];
}

interface AttrResult {
  pts: number[];
  clVal: number;
  ucl: number;
  lcl: number;
  uclPoints?: number[];
  lclPoints?: number[];
  stepped?: boolean;
  chartLabel: string;
  /** p and np only */
  dpm: number | null;
  /** p and np only; null also when p̄ = 0 (no finite Z) */
  sigmaLvl: number | null;
  metric: number;
  metricLabel: string;
  violations: Violation[];
  dataAdequacy: { n: number; tier: 'low' | 'moderate' | 'adequate'; label: string };
  testSet?: TestSet;
  /** report-card data checks (lib/spc/attributeChecks.server.ts) */
  checks?: AttrChecks;
}

type CheckStatus = 'ok' | 'warn' | 'na';
interface AttrChecks {
  subgroups: { status: CheckStatus; have: number; need: number | null; basis: number; nBar: number };
  size: { status: CheckStatus; small: number[]; minProduct: number; minSize: number | null };
}

/** "3, 7, 12" — at most 8 numbers, then "…" */
const listText = (v: number[]) => (v.length > 8 ? `${v.slice(0, 8).join(', ')}, …` : v.join(', '));

/** One subgroup as typed: units inspected (p, u) and the count */
interface Row {
  n: string;
  d: string;
}

/** What was sent to the server for the result on screen */
interface Analyzed {
  type: AttrChartType;
  fixedN: number;
  testSet: TestSet;
  /** [units, count] for p and u, [count] for np and c */
  data: number[][];
}

const needsN = (t: AttrChartType) => t === 'p' || t === 'u';
const isDefectives = (t: AttrChartType) => t === 'p' || t === 'np';

function niceNum(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}
/** Decimals for the chart's own statistic: proportions and rates get 4, counts 3 */
const statDigits = (t: AttrChartType) => (t === 'p' || t === 'u' ? 4 : 3);
const isNum = (v: string) => v.trim() !== '' && Number.isFinite(Number(v));

/** Rows from a pasted or uploaded grid: header and non-numeric rows are skipped */
function rowsFromGrid(grid: string[][], type: AttrChartType): Row[] {
  const rows: Row[] = [];
  for (const raw of grid) {
    const cells = raw.map(v => v.trim()).filter(v => v !== '');
    if (needsN(type)) {
      if (cells.length >= 2 && isNum(cells[0]) && isNum(cells[1])) rows.push({ n: cells[0], d: cells[1] });
    } else if (cells.length >= 1 && isNum(cells[0])) {
      rows.push({ n: '', d: cells[0] });
    }
  }
  return rows;
}

function exampleRows(type: AttrChartType): Row[] {
  const ex = ATTRIBUTE_EXAMPLES[type];
  return ex.counts.map((d, i) => ({ n: needsN(type) ? String(ex.sizes[i]) : '', d: String(d) }));
}

/** Running estimate after each subgroup, in the chart's own units (last point = centre line) */
function cumulativeSeries(a: Analyzed): number[] {
  let sumD = 0, sumN = 0;
  return a.data.map((row, i) => {
    if (needsN(a.type)) { sumN += row[0]; sumD += row[1]; return sumD / sumN; }
    sumD += row[0];
    return sumD / (i + 1);
  });
}

export default function AttributeChartsPage() {
  const [theme, setTheme] = usePersistedTheme();
  const { t, lang } = useLanguage();
  const c = COLORS[theme];
  const s = getSharedStyles(theme);
  const { isPro, isLoggedIn } = useSubscription();

  const [type, setType] = useState<AttrChartType>('p');
  const [fixedN, setFixedN] = useState('100');
  const [testSet, setTestSet] = useState<TestSet>('assistant');
  const [rows, setRows] = useState<Row[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>('setup');
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState('');
  const [analyzed, setAnalyzed] = useState<Analyzed | null>(null);
  const [result, setResult] = useState<AttrResult | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<false | 'rate' | 'error'>(false);
  const [loadedProjectName, setLoadedProjectName] = useState('');
  const [loadError, setLoadError] = useState('');

  const controlRef = useRef<ChartJSInstance<'line'>>(null);
  const cumRef = useRef<ChartJSInstance<'line'>>(null);

  // ── Data entry ──────────────────────────────────────────────────────────
  // When the pasted columns don't fit the chosen chart, the page says which chart fits
  const [suggest, setSuggest] = useState<{ to: AttrChartType; why: TKey } | null>(null);
  const lastGrid = useRef<string[][] | null>(null);
  const gridImport = useGridImport({
    onGrid: grid => {
      lastGrid.current = grid;
      const numericRows = grid.map(r => r.filter(v => isNum(v)).length).filter(k => k > 0);
      const twoCols = numericRows.length > 0 && numericRows.filter(k => k >= 2).length >= numericRows.length / 2;
      if (needsN(type) && !twoCols) setSuggest({ to: type === 'p' ? 'np' : 'c', why: 'attr_sug_one_col' });
      else if (!needsN(type) && twoCols) setSuggest({ to: type === 'np' ? 'p' : 'u', why: 'attr_sug_two_cols' });
      else setSuggest(null);
      const parsed = rowsFromGrid(grid, type);
      if (parsed.length > 0) setRows(parsed);
    },
  });

  function chooseType(next: AttrChartType) {
    if (next === type) return;
    setSuggest(null);
    setType(next);
    setResult(null);
    setAnalyzed(null);
    setError('');
    setFailed(false);
  }

  function applySuggestion() {
    if (!suggest) return;
    const to = suggest.to;
    chooseType(to);
    if (lastGrid.current) {
      const parsed = rowsFromGrid(lastGrid.current, to);
      if (parsed.length > 0) setRows(parsed);
    }
  }

  const exampleQueued = useRef(false);
  function loadExample() {
    setRows(exampleRows(type));
    if (type === 'np') setFixedN(String(ATTRIBUTE_EXAMPLES.np.sizes[0]));
    exampleQueued.current = true;
  }

  function clearData() {
    setRows([]);
    setResult(null);
    setAnalyzed(null);
    setError('');
    setFailed(false);
  }

  const updateRow = (i: number, field: keyof Row, v: string) => setRows(prev => prev.map((r, k) => (k === i ? { ...r, [field]: v } : r)));
  const removeRow = (i: number) => setRows(prev => prev.filter((_, k) => k !== i));
  const addRow = () => setRows(prev => [...prev, { n: '', d: '' }]);

  // ── Checks, then the server calculation ──────────────────────────────────
  function validate(): Analyzed | null {
    const two = needsN(type);
    let size = 0;
    if (type === 'np') {
      size = Number(fixedN);
      if (!Number.isInteger(size) || size <= 0) { setError(t('attr_err_fixed_n')); return null; }
    }
    const data: number[][] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const blankN = r.n.trim() === '', blankD = r.d.trim() === '';
      if (blankD && (!two || blankN)) continue; // empty row: ignored
      const label = String(i + 1);
      if (blankD || (two && blankN) || !isNum(r.d) || (two && !isNum(r.n))) { setError(t('attr_err_incomplete').replace('{n}', label)); return null; }
      const d = Number(r.d);
      if (d < 0) { setError(t('attr_err_negative').replace('{n}', label)); return null; }
      if (two) {
        const n = Number(r.n);
        if (n <= 0) { setError(t('attr_err_size').replace('{n}', label)); return null; }
        if (type === 'p' && d > n) {
          setError(t('attr_err_exceeds').replace('{n}', label));
          setSuggest({ to: 'u', why: 'attr_sug_exceeds' });
          return null;
        }
        data.push([n, d]);
      } else {
        if (type === 'np' && d > size) { setError(t('attr_err_exceeds').replace('{n}', label)); return null; }
        data.push([d]);
      }
    }
    if (data.length < 5) { setError(t('attr_err_min5')); return null; }
    return { type, fixedN: size, testSet, data };
  }

  async function runAnalysis(a: Analyzed) {
    setPending(true);
    setFailed(false);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'attribute', data: a.data, attrType: a.type, fixedN: a.type === 'np' ? a.fixedN : 100, sigmaConvention: 'direct', testSet: a.testSet }),
      });
      if (res.status === 429) { setFailed('rate'); setResult(null); return; }
      const json = await res.json();
      if (!res.ok) { setError(t('attr_err_server')); setResult(null); return; }
      setAnalyzed(a);
      setResult(json as AttrResult);
    } catch {
      setFailed('error');
      setResult(null);
    } finally {
      setPending(false);
    }
  }

  function analyze() {
    setError('');
    setSuggest(null);
    const a = validate();
    if (!a) { setResult(null); return; }
    setMobileTab('results');
    void runAnalysis(a);
  }

  // Runs once after "Try an example" has put the example data in place
  useEffect(() => {
    if (!exampleQueued.current) return;
    exampleQueued.current = false;
    analyze();
  });

  // A saved project (?id=…) opens with its data and analyses again
  useEffect(() => {
    // Puts a saved project, or the draft kept by lib/draft.ts, back on screen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apply = ({ analysis }: { analysis: any }) => {
      const inp = analysis.input_data as Analyzed;
      setType(inp.type);
      setTestSet(inp.testSet);
      if (inp.type === 'np') setFixedN(String(inp.fixedN));
      setRows(inp.data.map(r => (needsN(inp.type) ? { n: String(r[0]), d: String(r[1]) } : { n: '', d: String(r[0]) })));
      setLoadedProjectName(analysis.name as string);
      void runAnalysis(inp);
    };
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
      // No saved project in the address: bring back this visitor's analysis
      // from before they signed in or opened the Pro page, if there is one
      const draft = takeDraft('attribute');
      if (draft) { try { apply({ analysis: draft }); } catch { /* a draft from an older version: ignore it */ } }
      return;
    }
    fetch(`/api/saved-analyses/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(apply)
      .catch(() => setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived display values (nothing here changes the calculation) ────────
  const view = analyzed ?? { type, fixedN: 0, testSet, data: [] };
  const vt = view.type;
  const digits = statDigits(vt);
  const cumulative = useMemo(() => (analyzed && result ? cumulativeSeries(analyzed) : null), [analyzed, result]);
  const failedPoints = useMemo(() => {
    const set = new Set<number>();
    result?.violations.forEach(v => v.failedAt.forEach(p => set.add(p - 1)));
    return set;
  }, [result]);

  const totals = useMemo(() => {
    if (!analyzed) return null;
    const count = analyzed.data.reduce((sum, r) => sum + (needsN(analyzed.type) ? r[1] : r[0]), 0);
    const units = needsN(analyzed.type) ? analyzed.data.reduce((sum, r) => sum + r[0], 0) : analyzed.type === 'np' ? analyzed.fixedN * analyzed.data.length : null;
    return { count, units, k: analyzed.data.length };
  }, [analyzed]);

  const statName = (tp: AttrChartType) => (tp === 'p' ? 'Proportion defective' : tp === 'np' ? 'Number defective' : tp === 'c' ? 'Defects' : 'Defects per unit');
  const clName = (tp: AttrChartType) => (tp === 'p' ? 'p̄' : tp === 'np' ? 'n̄p' : tp === 'c' ? 'c̄' : 'ū');
  const chartTitle = (tp: AttrChartType) => `${tp} chart`;
  const stepped = !!result?.stepped;
  const pDefective = result ? (vt === 'p' ? result.clVal : vt === 'np' && analyzed ? result.clVal / analyzed.fixedN : null) : null;
  const signals: ViolationItem[] = result ? result.violations.map(v => ({ rule: v.rule, label: v.label, desc: v.desc, points: v.points, chart: t(`attr_${vt}_t` as TKey) })) : [];
  const stable = signals.length === 0;
  const testsLabel = t((result?.testSet ?? testSet) === 'all' ? 'attr_tests_all' : 'attr_tests_assistant');

  // ── Data checks: plain words on screen, technical detail one click away ──
  const checks = result?.checks ?? null;
  const rateName = vt === 'p' || vt === 'np' ? 'p̄' : 'ū';
  const basisName = vt === 'p' || vt === 'np' ? 'p̄' : 'c̄';
  const checkRows = checks ? [
    {
      key: 'sub',
      status: checks.subgroups.status,
      title: t('attr_chk_sub_t'),
      text: checks.subgroups.status === 'na'
        ? t('attr_chk_na_text')
        : t(checks.subgroups.status === 'ok' ? 'attr_chk_sub_ok' : 'attr_chk_sub_warn')
          .replace('{have}', String(checks.subgroups.have))
          .replace('{need}', String(checks.subgroups.need))
          .replace('{more}', String(Math.max(0, (checks.subgroups.need ?? 0) - checks.subgroups.have))),
      tech: checks.subgroups.need === null ? null : t(vt === 'c' ? 'attr_chk_sub_tech_c' : 'attr_chk_sub_tech')
        .replace('{need}', String(checks.subgroups.need))
        .replace('{basis}', `${basisName} = ${niceNum(checks.subgroups.basis, 4)}`)
        .replace('{nbar}', Number.isInteger(checks.subgroups.nBar) ? String(checks.subgroups.nBar) : niceNum(checks.subgroups.nBar, 2)),
    },
    {
      key: 'size',
      status: checks.size.status,
      title: t('attr_chk_size_t'),
      text: checks.size.status === 'na'
        ? t('attr_chk_na_text')
        : checks.size.status === 'ok'
          ? t('attr_chk_size_ok')
          : vt === 'c'
            ? t('attr_chk_size_warn_c')
            : t('attr_chk_size_warn').replace('{list}', listText(checks.size.small)).replace('{min}', String(checks.size.minSize)),
      tech: checks.size.status === 'na' ? null : t('attr_chk_size_tech').replace('{rate}', rateName).replace('{min}', niceNum(checks.size.minProduct, 2)),
    },
  ] : [];
  const checkStatusEn = (st: CheckStatus) => (st === 'ok' ? 'Passed' : st === 'warn' ? 'Check' : 'Not available');
  const exportChecks = (): [string, string][] => (checks ? [
    ['Number of subgroups', checks.subgroups.need === null ? 'Not available: no defectives or defects in the data' : `${checkStatusEn(checks.subgroups.status)}: ${checks.subgroups.have} subgroups, ${checks.subgroups.need} needed (so that test 1 false alarms stay at or below 2% with 95% confidence)`],
    ['Subgroup size', checks.size.status === 'warn'
      ? `Check: ${vt === 'c' ? 'average defects per subgroup below 0.5' : `subgroups ${listText(checks.size.small)} below n × ${rateName} = 0.5 (use n ≥ ${checks.size.minSize})`}`
      : `${checkStatusEn(checks.size.status)}: smallest n × ${rateName} = ${niceNum(checks.size.minProduct, 2)} (rule: at least 0.5)`],
  ] : []);

  // ── Charts ───────────────────────────────────────────────────────────────
  const labels = result ? result.pts.map((_, i) => String(i + 1)) : [];
  const limitLine = (v: number[] | undefined, single: number) => (v ? v : labels.map(() => single));
  const baseOptions = (yTitle: string, yZero = true) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    devicePixelRatio: 2,
    layout: watermarkLayout(),
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      watermark: watermarkOptions('normal'),
      legend: { display: true, labels: { color: c.muted, font: { size: 11 }, boxWidth: 14 } },
      tooltip: { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, titleColor: c.text, bodyColor: c.muted, padding: 10 },
    },
    scales: {
      x: { title: { display: true, text: 'Subgroup', color: c.muted }, ticks: { color: c.muted, autoSkip: true, maxTicksLimit: 25 }, grid: { display: false }, border: { color: c.border } },
      y: { title: { display: true, text: yTitle, color: c.muted }, ticks: { color: c.muted }, grid: { color: c.grid }, border: { color: c.border }, beginAtZero: yZero },
    },
  });

  const controlData = result ? {
    labels,
    datasets: [
      {
        label: statName(vt),
        data: result.pts,
        borderColor: c.data,
        backgroundColor: c.data,
        pointBackgroundColor: result.pts.map((_, i) => (failedPoints.has(i) ? c.danger : c.data)),
        pointBorderColor: result.pts.map((_, i) => (failedPoints.has(i) ? c.danger : c.data)),
        pointRadius: result.pts.map((_, i) => (failedPoints.has(i) ? 5 : 3.5)),
        borderWidth: 2,
        tension: 0,
      },
      { label: 'UCL', data: limitLine(result.uclPoints, result.ucl), borderColor: c.danger, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, stepped: stepped ? ('middle' as const) : false },
      { label: `CL (${clName(vt)})`, data: labels.map(() => result.clVal), borderColor: c.muted, borderDash: [2, 2], borderWidth: 1, pointRadius: 0 },
      { label: 'LCL', data: limitLine(result.lclPoints, result.lcl), borderColor: c.danger, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, stepped: stepped ? ('middle' as const) : false },
    ],
  } : null;

  const cumData = result && cumulative ? {
    labels,
    datasets: [
      { label: `Cumulative ${clName(vt)}`, data: cumulative, borderColor: c.data, backgroundColor: c.data, pointRadius: 2.5, borderWidth: 2, tension: 0 },
      { label: `Final ${clName(vt)}`, data: labels.map(() => result.clVal), borderColor: c.muted, borderDash: [4, 3], borderWidth: 1, pointRadius: 0 },
    ],
  } : null;

  // Charts drawn while their tab was hidden need a resize when it shows
  useEffect(() => {
    const id = requestAnimationFrame(() => { controlRef.current?.resize(); cumRef.current?.resize(); });
    return () => cancelAnimationFrame(id);
  }, [mobileTab, result]);

  // ── Shared export pieces ─────────────────────────────────────────────────
  const fileBase = `${vt}-chart`;
  const countHeader = isDefectives(vt) ? 'Defectives' : 'Defects';
  const exportRows = () => (analyzed && result ? analyzed.data.map((r, i) => ({
    i: i + 1,
    n: needsN(analyzed.type) ? r[0] : analyzed.type === 'np' ? analyzed.fixedN : null,
    count: needsN(analyzed.type) ? r[1] : r[0],
    stat: result.pts[i],
    ucl: result.uclPoints ? result.uclPoints[i] : result.ucl,
    lcl: result.lclPoints ? result.lclPoints[i] : result.lcl,
    flag: failedPoints.has(i),
  })) : []);
  const summaryPairs = (): [string, string][] => {
    if (!result || !totals) return [];
    const out: [string, string][] = [
      ['Chart', chartTitle(vt)],
      ['Subgroups', String(totals.k)],
    ];
    if (totals.units !== null) out.push(['Units inspected', String(totals.units)]);
    out.push([countHeader, String(totals.count)]);
    out.push([`Centre line (${clName(vt)})`, niceNum(result.clVal, digits)]);
    out.push([stepped ? 'UCL (last subgroup)' : 'UCL', niceNum(result.ucl, digits)]);
    out.push([stepped ? 'LCL (last subgroup)' : 'LCL', niceNum(result.lcl, digits)]);
    if (pDefective !== null) out.push(['% defective', `${niceNum(pDefective * 100, 2)}%`]);
    if (result.dpm !== null) out.push(['Defective PPM', Math.round(result.dpm).toLocaleString('en-US')]);
    if (result.dpm !== null) out.push(['Process Z', niceNum(result.sigmaLvl, 2)]);
    if (vt === 'u') out.push(['Defects per unit (DPU)', niceNum(result.clVal, 4)]);
    out.push(['Tests', (result.testSet ?? testSet) === 'all' ? 'All tests (1–4)' : 'Standard default tests (1, 2)']);
    return out;
  };

  // ── Export: CSV (free account) ───────────────────────────────────────────
  function exportCSV() {
    if (!isLoggedIn) { goToLogin('attribute', 'csv'); return; }
    if (!result || !analyzed) return;
    const header = ['Subgroup', ...(needsN(vt) || vt === 'np' ? ['Units inspected'] : []), countHeader, statName(vt), 'UCL', 'LCL', 'Signal'].join(',');
    const body = exportRows().map(r => [r.i, ...(r.n !== null ? [r.n] : []), r.count, niceNum(r.stat, 6), niceNum(r.ucl, 6), niceNum(r.lcl, 6), r.flag ? 'yes' : ''].join(',')).join('\n');
    const summary = summaryPairs().map(([k, v]) => `${k},"${v}"`).join('\n');
    const blob = new Blob(['﻿', `${header}\n${body}\n\n${summary}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export: PNG (free account, watermarked; Pro, clean) ──────────────────
  function exportPNG() {
    if (!isLoggedIn) { goToLogin('attribute', 'png'); return; }
    const charts = [controlRef.current, cumRef.current];
    const run = () => {
      const save = (ch: ChartJSInstance<'line'> | null, name: string) => {
        if (!ch) return;
        const a = document.createElement('a');
        a.href = ch.toBase64Image('image/png', 1);
        a.download = name;
        a.click();
      };
      save(controlRef.current, `${fileBase}.png`);
      save(cumRef.current, `${fileBase}-cumulative.png`);
    };
    void (isPro ? withWatermarksDisabled(charts, run) : withPrintColors(charts, run));
  }

  // ── Export: Excel (Pro) ──────────────────────────────────────────────────
  async function runExportExcel() {
    if (!isPro) { goToPricing('attribute', 'excel'); return; }
    if (!result || !analyzed || !totals) return;
    const report = createReport({ toolName: 'Attribute Control Chart' });
    const overview = report.addSheet('Summary');
    overview.titleBand(`${chartTitle(vt)} Report`, `${totals.k} subgroups   |   ${clName(vt)} = ${niceNum(result.clVal, digits)}   |   ${stable ? 'Stable' : `${signals.length} special-cause signal(s)`}`);
    overview.metaStrip([['Generated on', nowStamp()]]);

    overview.sectionHeading('Results');
    overview.table({
      headers: [
        { header: 'Item', key: 'k', align: 'left', width: 30 },
        { header: 'Value', key: 'v', align: 'right', width: 22 },
      ],
      rows: summaryPairs().map(([k, v]) => ({ k, v })),
    });
    if (stepped) overview.note('Sample sizes differ: the control limits step with each subgroup size, and the tests for special causes use the standardized points.', 'neutral');
    if (checks) {
      overview.sectionHeading('Data Checks');
      overview.table({
        headers: [
          { header: 'Check', key: 'k', align: 'left', width: 24 },
          { header: 'Result', key: 'v', align: 'left', width: 70 },
        ],
        rows: exportChecks().map(([k, v]) => ({ k, v })),
        rowTones: [checks.subgroups.status, checks.size.status].map(st => (st === 'ok' ? 'good' as const : 'warning' as const)),
      });
    }
    overview.note(stable
      ? 'No special-cause signals: the rate above is a fair estimate of the process today.'
      : 'The process is not stable: the rate describes the past period only. Find and remove the special causes before using it as a baseline.', stable ? 'good' : 'warning');

    await overview.charts([
      { ref: controlRef, title: chartTitle(vt) },
      { ref: cumRef, title: 'Cumulative rate' },
    ], { widthCm: 17, heightCm: 8 });

    if (signals.length > 0) {
      overview.sectionHeading('Special-Cause Signals');
      overview.table({
        headers: [
          { header: 'Test', key: 'rule', align: 'left', width: 8 },
          { header: 'Description', key: 'desc', align: 'left', width: 36 },
          { header: 'Subgroups', key: 'points', align: 'left', width: 20 },
        ],
        rows: signals.map(v => ({ rule: `#${v.rule}`, desc: v.label, points: violationPointsText(v) })),
        rowTones: signals.map(() => 'warning' as const),
      });
    }

    const dataSheet = report.addSheet('Data');
    dataSheet.sectionHeading('Subgroups');
    const er = exportRows();
    const fmtStat = digits === 4 ? '0.0000' : '0.000';
    dataSheet.table({
      headers: [
        { header: 'Subgroup', key: 'i', align: 'right' },
        ...(er[0]?.n !== null ? [{ header: 'Units inspected', key: 'n', align: 'right' as const }] : []),
        { header: countHeader, key: 'count', align: 'right' },
        { header: statName(vt), key: 'stat', align: 'right', numFmt: fmtStat },
        { header: 'UCL', key: 'ucl', align: 'right', numFmt: fmtStat },
        { header: 'LCL', key: 'lcl', align: 'right', numFmt: fmtStat },
      ],
      rows: er.map(r => ({ i: r.i, n: r.n ?? '', count: r.count, stat: r.stat, ucl: r.ucl, lcl: r.lcl })),
      rowTones: er.map(r => (r.flag ? 'warning' as const : undefined)),
      zebra: true,
    });
    dataSheet.freezeHeader(2);
    await report.download(`${fileBase}.xlsx`);
  }

  // ── Export: PDF (Pro) ────────────────────────────────────────────────────
  function runExportPDF() {
    if (!isPro) { goToPricing('attribute', 'pdf'); return; }
    if (!result || !analyzed || !totals) return;
    const ctx = createPdfReport(`${chartTitle(vt)} Report`, 'attribute');
    calloutBox(ctx, `${clName(vt)} = ${niceNum(result.clVal, digits)}   |   UCL = ${niceNum(result.ucl, digits)}   |   LCL = ${niceNum(result.lcl, digits)}${stepped ? ' (last subgroup)' : ''}   |   ${totals.k} subgroups`, 'info');
    addChartImage(ctx, controlRef.current, chartTitle(vt), undefined, stepped ? 'Sample sizes differ: the limits step with each subgroup size.' : undefined);

    const pairs = summaryPairs();
    const studyKeys = ['Chart', 'Subgroups', 'Units inspected', countHeader, 'Tests'];
    twoColumnTables(ctx, 'Study', pairs.filter(([k]) => studyKeys.includes(k)) as KVRow[], 'Results', pairs.filter(([k]) => !studyKeys.includes(k)) as KVRow[]);

    if (checks) {
      dataTable(ctx, 'Data Checks', [
        { header: 'CHECK', width: 130 },
        { header: 'RESULT', width: ctx.pageWidth - ctx.margin * 2 - 130 },
      ], exportChecks(), {
        cellColors: [checks.subgroups.status, checks.size.status].map(st => [st === 'ok' ? null : REPORT_COLORS.warn, null]),
      });
    }
    calloutBox(ctx, stable
      ? 'No special-cause signals were detected: the rate is a fair estimate of the process today.'
      : `${signals.length} special-cause signal(s) were detected: the rate describes the past period only. Find and remove the causes before using it as a baseline.`, stable ? 'good' : 'warn');
    if (!stable) {
      dataTable(ctx, 'Special-Cause Signals', [
        { header: 'TEST', width: 50 },
        { header: 'DESCRIPTION', width: 260 },
        { header: 'SUBGROUPS', width: ctx.pageWidth - ctx.margin * 2 - 310 },
      ], signals.map(v => [`#${v.rule}`, v.label, violationPointsText(v)]));
    }

    addChartImage(ctx, cumRef.current, 'Cumulative rate', undefined, 'The running estimate after each subgroup; a flat end means enough subgroups were collected.');

    const er = exportRows();
    const withN = er[0]?.n !== null;
    const cols = withN ? 6 : 5;
    const w = (ctx.pageWidth - ctx.margin * 2) / cols;
    dataTable(ctx, 'Data', [
      { header: '#', width: w, align: 'right' },
      ...(withN ? [{ header: 'UNITS', width: w, align: 'right' as const }] : []),
      { header: countHeader.toUpperCase(), width: w, align: 'right' },
      { header: vt.toUpperCase(), width: w, align: 'right' },
      { header: 'UCL', width: w, align: 'right' },
      { header: 'LCL', width: w, align: 'right' },
    ], er.map(r => [String(r.i), ...(withN ? [String(r.n)] : []), String(r.count), niceNum(r.stat, digits), niceNum(r.ucl, digits), niceNum(r.lcl, digits)]), {
      cellColors: er.map(r => (r.flag ? [REPORT_COLORS.warn, ...Array(cols - 1).fill(null)] : Array(cols).fill(null))),
    });

    finalizeReport(ctx);
    ctx.pdf.save(`${fileBase}.pdf`);
  }

  const exportExcel = () => withWatermarksDisabled([controlRef.current, cumRef.current], runExportExcel);
  const exportPDF = () => withWatermarksDisabled([controlRef.current, cumRef.current], runExportPDF);

  // ── Layout ───────────────────────────────────────────────────────────────
  const compactSave = useCompactSave();
  const helpSteps = [
    { t: t('attr_help_s1_t'), d: t('attr_help_s1_d') },
    { t: t('attr_help_s2_t'), d: t('attr_help_s2_d') },
    { t: t('attr_help_s3_t'), d: t('attr_help_s3_d') },
    { t: t('attr_help_s4_t'), d: t('attr_help_s4_d') },
  ];
  const kpis: { label: string; value: string; sub?: string; tone?: string }[] = [];
  if (result && totals) {
    kpis.push({ label: t('attr_kpi_subgroups'), value: String(totals.k) });
    if (totals.units !== null) kpis.push({ label: t('attr_kpi_inspected'), value: totals.units.toLocaleString('en-US') });
    kpis.push({ label: t(isDefectives(vt) ? 'attr_kpi_defectives' : 'attr_kpi_defects'), value: totals.count.toLocaleString('en-US') });
    if (vt === 'np') kpis.push({ label: t('attr_kpi_avg_np'), value: niceNum(result.clVal, 3) });
    if (vt === 'c') kpis.push({ label: t('attr_kpi_avg_c'), value: niceNum(result.clVal, 3) });
    if (vt === 'u') kpis.push({ label: t('attr_kpi_dpu'), value: niceNum(result.clVal, 4), tone: c.accent });
    if (pDefective !== null) kpis.push({ label: t('attr_kpi_pct'), value: `${niceNum(pDefective * 100, 2)}%`, tone: c.accent });
    if (result.dpm !== null) kpis.push({ label: t('attr_kpi_dpm'), value: Math.round(result.dpm).toLocaleString('en-US') });
    if (result.dpm !== null) kpis.push({ label: t('attr_kpi_z'), value: niceNum(result.sigmaLvl, 2) });
    kpis.push({ label: t('attr_kpi_ucl'), value: niceNum(result.ucl, digits), sub: stepped ? t('attr_kpi_last') : undefined });
    kpis.push({ label: t('attr_kpi_lcl'), value: niceNum(result.lcl, digits), sub: stepped ? t('attr_kpi_last') : undefined });
  }
  const two = needsN(type);
  const filled = rows.filter(r => r.d.trim() !== '' || r.n.trim() !== '').length;

  return (
    <div style={s.page}>
      <ToolStyles />
      <style>{`
        .at-group { margin-top: 10px; }
        .at-group-t { font-size: 11px; color: var(--qh-muted); margin-bottom: 6px; font-weight: 600; letter-spacing: .02em; }
        .at-picks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .at-pick { text-align: start; background: var(--qh-surface); border: 1px solid var(--qh-border); border-radius: 10px; padding: 10px 12px; cursor: pointer; color: var(--qh-text); font: inherit; transition: border-color .15s, background .15s; min-width: 0; }
        .at-pick:hover { border-color: color-mix(in srgb, var(--qh-accent) 55%, var(--qh-border)); }
        .at-pick[aria-checked="true"] { border-color: var(--qh-accent); background: color-mix(in srgb, var(--qh-accent) 10%, var(--qh-surface)); box-shadow: 0 0 0 1px var(--qh-accent) inset; }
        .at-pick b { display: block; font-size: 15px; font-weight: 700; margin-bottom: 2px; }
        .at-pick span { display: block; font-size: 12px; color: var(--qh-muted); line-height: 1.5; }
        .at-rate { display: flex; gap: 12px; align-items: flex-start; }
        .at-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex: 0 0 auto; }
        .at-kpi small { display: block; font-size: 11px; color: var(--qh-muted); margin-top: 2px; font-family: inherit; }
        .at-suggest { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; line-height: 1.6; background: color-mix(in srgb, var(--qh-amber) 10%, var(--qh-surface)); border: 1px solid color-mix(in srgb, var(--qh-amber) 40%, var(--qh-border)); border-radius: 10px; padding: 8px 12px; margin-bottom: 10px; }
        .at-suggest span { flex: 1 1 240px; }
        .at-check { display: flex; gap: 12px; align-items: flex-start; border: 1px solid; border-radius: 10px; padding: 10px 12px; margin-top: 8px; }
        .at-check-icon { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex: 0 0 auto; }
        .at-tech { margin-top: 6px; font-size: 12px; color: var(--qh-muted); }
        .at-tech summary { cursor: pointer; font-weight: 600; }
        .at-tech div { margin-top: 4px; line-height: 1.6; }
        @media (max-width: 420px) { .at-picks { grid-template-columns: 1fr; } }
      `}</style>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_attr" />

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
        <ToolSidebar current="/attribute-charts" />

        <div className="tl-main">
          <ToolHeader title={t('attr_title')} intro={t('attr_intro')} route={{ text: t('attr_route_text'), href: '/imr-chart', label: t('attr_route_link') }} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('attr_help_title')} steps={helpSteps} onExample={loadExample} showCapability={false} tip={t('attr_help_tip')} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={filled} />

          <div className="tl-top">
            {/* ── SETUP ──────────────────────────────────────────────────── */}
            <section className="tl-panel tl-setup tl-card" data-active={mobileTab === 'setup'} aria-label={t('spc_tab_setup')}>
              <div>
                <div className="tl-label">{t('attr_pick_label')}</div>
                <div className="tl-hint" style={{ marginTop: 0 }}>{t('attr_pick_hint')}</div>
                {([['attr_group_defectives', ['p', 'np']], ['attr_group_defects', ['c', 'u']]] as [TKey, AttrChartType[]][]).map(([g, list]) => (
                  <div key={g} className="at-group">
                    <div className="at-group-t">{t(g)}</div>
                    <div className="at-picks" role="radiogroup" aria-label={t(g)}>
                      {list.map(tp => (
                        <button key={tp} type="button" role="radio" aria-checked={type === tp} className="at-pick" onClick={() => chooseType(tp)}>
                          <b>{t(`attr_${tp}_t` as TKey)}</b>
                          <span>{t(`attr_${tp}_d` as TKey)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {type === 'np' && (
                <label className="tl-field">
                  <span>{t('attr_fixed_n')}</span>
                  <input type="number" min={1} step={1} value={fixedN} onChange={e => setFixedN(e.target.value)} aria-label={t('attr_fixed_n')} />
                  <div className="tl-hint">{t('attr_fixed_n_hint')}</div>
                </label>
              )}

              <label className="tl-field">
                <span>{t('spc_tests_label')}</span>
                <select style={s.select} value={testSet} onChange={e => setTestSet(e.target.value as TestSet)}>
                  <option value="assistant">{t('attr_tests_assistant')}</option>
                  <option value="all">{t('attr_tests_all')}</option>
                </select>
              </label>

              <div className="tl-setup-analyze">
                <button className="tl-analyze" onClick={analyze} disabled={pending}>{pending ? t('spc_analyzing') : t('spc_analyze_btn')}</button>
              </div>
            </section>

            <div className="tl-col">
              {/* ── DATA ─────────────────────────────────────────────────── */}
              <section className="tl-panel tl-data tl-card" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')}>
                <DataCardHead
                  countLabel={t('attr_rows_count').replace('{n}', String(filled))}
                  onUpload={gridImport.openFilePicker}
                  onClear={clearData}
                  extra={<gridImport.FileInput />}
                />
                {gridImport.fileError && <div className="tl-error" style={{ marginBottom: 10 }}>{gridImport.fileError}</div>}
                {suggest && suggest.to !== type && (
                  <div className="at-suggest" role="status">
                    <span>{t(suggest.why)}</span>
                    <button type="button" className="tl-xbtn tl-xbtn-sm" onClick={applySuggestion}>{t('attr_sug_switch').replace('{chart}', t(`attr_${suggest.to}_t` as TKey))}</button>
                    <button type="button" className="tl-xbtn tl-xbtn-sm" onClick={() => setSuggest(null)} aria-label={t('spc_help_close')}>✕</button>
                  </div>
                )}
                <SheetPicker
                  sheetNames={gridImport.sheetNames}
                  activeSheet={gridImport.activeSheet}
                  onSelect={gridImport.selectSheet}
                  accentColor={c.accent}
                  textColor={c.text}
                  mutedColor={c.muted}
                  borderColor={c.border}
                />
                <div className="tl-sg-wrap">
                  <table className="tl-sg">
                    <thead>
                      <tr>
                        <th>#</th>
                        {two && <th>{t(type === 'u' ? 'attr_col_units' : 'attr_col_n')}</th>}
                        <th>{t(isDefectives(type) ? 'attr_col_defectives' : 'attr_col_defects')}</th>
                        <th aria-label={t('spc_remove')}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td className="tl-sg-n" style={failedPoints.has(i) && analyzed?.type === type ? { color: c.danger, fontWeight: 700 } : undefined}>{i + 1}</td>
                          {two && (
                            <td><input type="number" min={0} value={r.n} aria-label={`${t('attr_col_n')} ${i + 1}`} onChange={e => updateRow(i, 'n', e.target.value)} /></td>
                          )}
                          <td><input type="number" min={0} value={r.d} aria-label={`${t(isDefectives(type) ? 'attr_col_defectives' : 'attr_col_defects')} ${i + 1}`} onChange={e => updateRow(i, 'd', e.target.value)} /></td>
                          <td><button type="button" className="tl-sg-x" aria-label={`${t('spc_remove_subgroup')} ${i + 1}`} onClick={() => removeRow(i)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <button type="button" className="tl-xbtn tl-add" onClick={addRow}>{t('attr_add_row')}</button>
                </div>
                <div className="tl-paste">{t(two ? 'attr_paste_two' : 'attr_paste_one')}</div>
              </section>

              {/* ── RESULTS ──────────────────────────────────────────────── */}
              <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
                {result && analyzed && (
                  <ResultsHead nPoints={result.pts.length} isNormal hasSpec={false}>
                    <ExportRow
                      isPro={isPro}
                      isLoggedIn={isLoggedIn}
                      hasResult
                      onCSV={exportCSV}
                      onPNG={exportPNG}
                      onExcel={exportExcel}
                      onPDF={exportPDF}
                      save={
                        <SaveAnalysisButton
                          theme={theme}
                          tool="attribute"
                          defaultName={`${chartTitle(vt)} — ${new Date().toLocaleDateString('en-US')}`}
                          compact={compactSave}
                          getPayload={() => (!analyzed || !result ? null : { input_data: analyzed, results: result })}
                        />
                      }
                    />
                  </ResultsHead>
                )}
                {error && <div className="tl-error">{error}</div>}

                {result && analyzed && (
                  <>
                    <VerdictCards stable={stable} nPoints={result.pts.length} nSubgroups={result.pts.length} signals={signals.length} verdict={null} reason={null} />

                    <div className="tl-kpis">
                      {kpis.map(k => (
                        <div key={k.label} className="tl-kpi at-kpi">
                          <span>{k.label}</span>
                          <b style={k.tone ? { color: k.tone } : undefined}>{k.value}</b>
                          {k.sub && <small>{k.sub}</small>}
                        </div>
                      ))}
                    </div>

                    {/* ── Control chart ─────────────────────────────────── */}
                    <div className="tl-chart">
                      <h3>{t(`attr_${vt}_t` as TKey)}</h3>
                      <div className="tl-chart-sub">
                        {clName(vt)} = {niceNum(result.clVal, digits)} · UCL = {niceNum(result.ucl, digits)} · LCL = {niceNum(result.lcl, digits)}
                        {stepped && <> · {t('spc_attr_stepped')}</>}
                      </div>
                      <div className="tl-chart-inner">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {controlData && <Chart ref={controlRef} type="line" data={controlData} options={baseOptions(statName(vt)) as any} />}
                      </div>
                    </div>

                    {/* ── Defect rate reading ───────────────────────────── */}
                    <div className="tl-card at-rate" style={{ borderColor: tint(stable ? c.good : c.amber, 35) }}>
                      <span className="at-dot" style={{ background: stable ? c.good : c.amber }} aria-hidden="true" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                          {t('attr_rate_title')}: <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', direction: 'ltr', unicodeBidi: 'isolate' }}>
                            {pDefective !== null ? `${niceNum(pDefective * 100, 2)}%` : `${clName(vt)} = ${niceNum(result.clVal, digits)}`}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.7 }}>{t(stable ? 'attr_rate_stable' : 'attr_rate_unstable')}</div>
                      </div>
                    </div>

                    {/* ── Cumulative rate ───────────────────────────────── */}
                    <div className="tl-chart">
                      <h3>{t('attr_cum_title')}</h3>
                      <div className="tl-chart-sub">{t('attr_cum_sub')}</div>
                      <div className="tl-chart-inner">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {cumData && <Chart ref={cumRef} type="line" data={cumData} options={baseOptions(`Cumulative ${clName(vt)}`, false) as any} />}
                      </div>
                    </div>

                    {checkRows.length > 0 && (
                      <div className="tl-card">
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{t('attr_chk_title')}</div>
                        <div style={{ fontSize: 12, color: c.muted, marginBottom: 10 }}>{t('attr_chk_sub')}</div>
                        {checkRows.map(r => {
                          const col = r.status === 'ok' ? c.good : c.amber;
                          return (
                            <div key={r.key} className="at-check" style={{ borderColor: tint(col, 30) }}>
                              <span className="at-check-icon" aria-hidden="true" style={{ background: tint(col, 16), color: col }}>{r.status === 'ok' ? '✓' : '!'}</span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px' }}>
                                  <b style={{ fontSize: 14 }}>{r.title}</b>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: col }}>{t(r.status === 'ok' ? 'attr_chk_ok' : r.status === 'warn' ? 'attr_chk_warn' : 'attr_chk_na')}</span>
                                </div>
                                <div style={{ fontSize: 13, color: c.text, lineHeight: 1.7, marginTop: 2 }}>{r.text}</div>
                                {r.tech && (
                                  <details className="at-tech">
                                    <summary>{t('attr_chk_detail')}</summary>
                                    <div>{r.tech}</div>
                                  </details>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <ViolationsCard items={signals} allTests={(result.testSet ?? testSet) === 'all'} testsLabel={testsLabel} />
                  </>
                )}
                {failed && <div className="tl-error">{t(failed === 'rate' ? 'tool_rate_limited' : 'tool_calc_failed')}</div>}
                {!result && !error && !failed && <div className="tl-card tl-empty">{pending ? t('tool_calculating') : t('attr_empty')}</div>}
                <p style={{ fontSize: 11, color: c.muted, opacity: 0.8, margin: 0 }}>{t('attr_footer')}</p>
              </section>
            </div>
          </div>
          <ToolGuide guide={ATTRIBUTE_GUIDE} lang={lang} />
        </div>
      </div>

      <PhoneBar showResultActions={mobileTab === 'results' && !!result} loading={pending} onAnalyze={analyze} onEdit={() => setMobileTab('data')} />
      <PasteToast show={gridImport.pasteToast} label={t('spc_toast')} />
    </div>
  );
}
