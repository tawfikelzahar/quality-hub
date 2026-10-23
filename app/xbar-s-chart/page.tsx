'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'chart.js/auto';
import { Chart } from 'react-chartjs-2';
import type { Chart as ChartJSInstance } from 'chart.js';
import { useChartAnalysis } from '@/lib/spc/useChartAnalysis';
import { messages as messagesEn } from '@/lib/spc/xbar-s-messages';
import { xbarSMessagesAr } from '@/lib/spc/xbar-s-messages.ar';
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme';
import Nav from '@/components/Nav';
import ToolSidebar from '@/components/ToolSidebar';
import ToolStyles from '@/components/tool/ToolStyles';
import { ToolHeader, HelpPanel, PhoneTabs, PhoneBar, VerdictCards, ResultsHead, ExportRow, KpiGrid, SubgroupTable, SpecLimits, DataCardHead, ViolationsCard, AdequacyCard, useCompactSave, type MobileTab, type ViolationItem } from '@/components/tool/ToolParts';
import { capabilityVerdict, capabilityReasonFor } from '@/lib/spc/verdict';
import { EXAMPLE_XBAR_S } from '@/lib/spc/examples';
import SaveAnalysisButton from '@/components/SaveAnalysisButton';
import { useSubscription } from '@/lib/useSubscription';
import { goToLogin, goToPricing } from '@/lib/exportGate';
import { useLanguage } from '@/lib/i18n/context';
import { createReport, nowStamp } from '@/lib/excelReport';
import { useGridImport } from '@/lib/gridImport';
import { SheetPicker, PasteToast } from '@/components/GridImportControls';
import { watermarkOptions, watermarkLayout, withWatermarksDisabled } from '@/lib/watermarkHelpers';
import {
  createReport as createPdfReport,
  classifyCapability,
  classificationBanner,
  twoColumnTables,
  dataTable,
  capabilityGauge,
  calloutBox,
  criteriaReferenceTable,
  addChartImage,
  finalizeReport,
  REPORT_COLORS,
  type KVRow,
} from '@/lib/pdf/reportDesign';


function parseSubgroupRows(text: string): number[][] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.map((line) => {
    // Excel/Sheets copy onto the clipboard as tab-separated; a typed or
    // uploaded .csv is comma-separated. Detect per line so both work.
    const delimiter = line.includes('\t') ? '\t' : ',';
    return line.split(delimiter).map((v) => Number(v.trim())).filter((v) => Number.isFinite(v));
  });
}

function niceNum(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 100000 || (Math.abs(n) < 0.0001 && n !== 0)) return n.toExponential(3);
  return n.toFixed(digits);
}

/** Normal distribution PDF, used to draw the Overall/Within curves over the histogram. */
function normalPdf(x: number, mu: number, sigma: number): number {
  if (!Number.isFinite(sigma) || sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Builds histogram bins + scaled Overall/Within normal curves, all on a shared linear x-axis. */
function buildCapabilityHistogram(
  values: number[],
  mu: number,
  sigmaOverall: number,
  sigmaWithin: number,
  lsl: number | null,
  usl: number | null
) {
  const n = values.length;
  if (n === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  // Sturges' rule, with sensible floor/ceiling for small/large samples.
  const binCount = Math.max(5, Math.min(20, Math.round(1 + Math.log2(n))));
  const binWidth = range / binCount;
  const binEdges = Array.from({ length: binCount + 1 }, (_, i) => min + i * binWidth);
  const binCounts = new Array(binCount).fill(0);
  values.forEach((v) => {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    binCounts[idx]++;
  });
  const binLabels = binEdges.slice(0, -1).map((edge) => edge + binWidth / 2);

  // Axis range must cover the data AND the spec limits, so a wide LSL/USL
  // (outside the observed data) doesn't get clipped off the chart.
  const specVals = [lsl, usl].filter((v): v is number => v !== null);
  const rangeMin = Math.min(min, ...specVals);
  const rangeMax = Math.max(max, ...specVals);
  const fullRange = rangeMax - rangeMin || 1;
  const curvePad = fullRange * 0.15;
  const axisMin = rangeMin - curvePad;
  const axisMax = rangeMax + curvePad;

  // Sample points across the full range for smooth curves.
  const curveN = 80;
  const curveX = Array.from({ length: curveN }, (_, i) => axisMin + ((axisMax - axisMin) * i) / (curveN - 1));
  // Scale each density curve so its peak roughly matches the histogram bar heights
  // (density * n * binWidth = expected count per bin under the fitted normal).
  const overallCurve = curveX.map((x) => normalPdf(x, mu, sigmaOverall) * n * binWidth);
  const withinCurve = curveX.map((x) => normalPdf(x, mu, sigmaWithin) * n * binWidth);
  const chartMaxY = Math.max(...binCounts, ...overallCurve, ...withinCurve) * 1.08;

  return { binLabels, binCounts, binWidth, curveX, overallCurve, withinCurve, axisMin, axisMax, chartMaxY };
}

export default function XbarSChartPage() {
  const [theme, setTheme] = usePersistedTheme();
  const { lang } = useLanguage();
  const messages = lang === 'ar' ? xbarSMessagesAr : messagesEn;
  const c = COLORS[theme];
  const s = getSharedStyles(theme);
  const { isPro, isLoggedIn } = useSubscription();

  // Subgroups as edited in the table (one row per subgroup). The analysis parses
  // them exactly as before; empty cells are left out so they never become 0.
  const [grid, setGrid] = useState<string[][]>([]);
  const [sgSize, setSgSize] = useState(5);
  const csvText = grid.map((row) => row.filter((v) => v.trim() !== '').join(', ')).join('\n');
  const [mobileTab, setMobileTab] = useState<MobileTab>('setup');
  const [helpOpen, setHelpOpen] = useState(false);
  const [lsl, setLsl] = useState('');
  const [usl, setUsl] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const [subgroups, setSubgroups] = useState<number[][] | null>(null);
  const [appliedLimits, setAppliedLimits] = useState<{ lsl: number | null; usl: number | null; target: number | null }>({ lsl: null, usl: null, target: null });
  const [loadedProjectName, setLoadedProjectName] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    fetch(`/api/saved-analyses/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const data = analysis.input_data as { subgroups: number[][]; lsl: number | null; usl: number | null; target: number | null };
        setSubgroups(data.subgroups);
        setGrid(data.subgroups.map((r) => r.map(String)));
        if (data.subgroups[0]) setSgSize(data.subgroups[0].length);
        setAppliedLimits({ lsl: data.lsl, usl: data.usl, target: data.target });
        setLsl(data.lsl !== null ? String(data.lsl) : '');
        setUsl(data.usl !== null ? String(data.usl) : '');
        setTarget(data.target !== null ? String(data.target) : '');
        setLoadedProjectName(analysis.name as string);
      })
      .catch(() =>
        setLoadError(lang === 'ar' ? 'تعذر تحميل المشروع المحفوظ.' : 'Could not load the saved project.')
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paste (anywhere on the page) and file upload (.csv/.xlsx/.xls) both just
  // fill csvText, exactly like typing or pasting into the textarea by hand —
  // Calculate still has to be pressed, same as before, so spec limits typed
  // above aren't silently skipped.
  const gridImport = useGridImport({
    onGrid: (rows) => {
      const clean = rows.map((r) => r.map((v) => v.trim()).filter((v) => v !== '')).filter((r) => r.length > 0);
      if (clean.length === 0) return;
      setGrid(clean);
      setSgSize(Math.max(...clean.map((r) => r.length)));
    },
  });

  // "Try an example": a golden dataset checked against Minitab, analysed right away
  const exampleQueued = useRef(false);
  function loadExample() {
    setGrid(EXAMPLE_XBAR_S.rows.map((r) => [...r]));
    setSgSize(EXAMPLE_XBAR_S.rows[0].length);
    setLsl(EXAMPLE_XBAR_S.lsl);
    setUsl(EXAMPLE_XBAR_S.usl);
    setTarget('');
    exampleQueued.current = true;
  }

  function clearData() {
    setGrid([]);
    setLsl('');
    setUsl('');
    setTarget('');
    setSubgroups(null);
    setError('');
  }

  function runAnalysis(): boolean {
    setError('');
    const rows = parseSubgroupRows(csvText).filter((r) => r.length > 0);

    if (rows.length === 0) {
      setError(messages.errorBadColumn);
      return false;
    }
    if (rows.length < 3) {
      setError(messages.errorInsufficientData);
      return false;
    }
    const sizes = new Set(rows.map((r) => r.length));
    if (sizes.size > 1) {
      setError(messages.errorInconsistentSubgroupSize);
      return false;
    }
    const n = rows[0].length;
    if (n < 2) {
      setError(messages.errorSubgroupTooSmall);
      return false;
    }

    const lslNum = lsl.trim() === '' ? null : Number(lsl);
    const uslNum = usl.trim() === '' ? null : Number(usl);
    const targetNum = target.trim() === '' ? null : Number(target);

    setAppliedLimits({
      lsl: Number.isFinite(lslNum as number) ? lslNum : null,
      usl: Number.isFinite(uslNum as number) ? uslNum : null,
      target: Number.isFinite(targetNum as number) ? targetNum : null,
    });
    setSubgroups(rows);
    return true;
  }

  const subgroupSize = subgroups && subgroups.length > 0 ? subgroups[0].length : 0;

  const chartData = subgroups && subgroupSize >= 2 ? subgroups : null;
  const { result, pending, failed } = useChartAnalysis('xbar-s', chartData, appliedLimits);

  const xChartRef = useRef<ChartJSInstance<'line'>>(null);
  const rChartRef = useRef<ChartJSInstance<'bar' | 'line'>>(null);
  const histChartRef = useRef<ChartJSInstance<'bar' | 'line', { x: number; y: number }[]>>(null);

  const violatedIndices = useMemo(() => {
    if (!result) return new Set<number>();
    const idxs = new Set<number>();
    result.violations_x.forEach((v) => {
      if (v.points.length === 2 && v.rule !== 1) {
        for (let i = v.points[0]; i <= v.points[1]; i++) idxs.add(i - 1);
      } else {
        v.points.forEach((p) => idxs.add(p - 1));
      }
    });
    return idxs;
  }, [result]);

  const histogramData = useMemo(() => {
    if (!result || !subgroups) return null;
    return buildCapabilityHistogram(subgroups.flat(), result.mu, result.sdOverall, result.sigma, result.LSL, result.USL);
  }, [result, subgroups]);

  // ── Export: CSV ─────────────────────────────────────────────────────
  function exportCSV() {
    if (!isLoggedIn) { goToLogin('xbar_s', 'csv'); return }
    if (!result || !subgroups) return;
    const header = `Subgroup,${subgroups[0].map((_, i) => `Value${i + 1}`).join(',')},XBar,StdDev\n`;
    const body = subgroups
      .map((row, i) => [i + 1, ...row, result.xbarVals[i], result.rangeVals[i]].join(','))
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xbar-s-chart.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export: Excel ────────────────────────────────────────────────────
  async function runExportExcel() {
    if (!isPro) { goToPricing('xbar_s', 'excel'); return }
    if (!result || !subgroups) return;

    const report = createReport({ toolName: 'Xbar-S Chart' });
    const overview = report.addSheet('Xbar-S Summary');
    overview.titleBand('Xbar-S Chart Report', `k = ${subgroups.length} subgroups   |   n = ${subgroupSize}   |   Grand Mean = ${niceNum(result.cl_x)}`);
    overview.metaStrip([['Generated on', nowStamp()]]);

    overview.sectionHeading('Control Limits');
    overview.table({
      headers: [
        { header: 'Chart', key: 'chart', align: 'left', width: 24 },
        { header: 'CL', key: 'cl', align: 'right', numFmt: '0.0000' },
        { header: 'UCL', key: 'ucl', align: 'right', numFmt: '0.0000' },
        { header: 'LCL', key: 'lcl', align: 'right', numFmt: '0.0000' },
      ],
      rows: [
        { chart: 'X̄ (Subgroup Average)', cl: result.cl_x, ucl: result.ucl_x, lcl: result.lcl_x },
        { chart: 'S (Std Dev)', cl: result.cl_r, ucl: result.ucl_r, lcl: result.lcl_r },
      ],
    });

    // ── Control chart images, via the shared charts() helper — same
    // Chart.js canvases used on screen and in the PDF export. ──
    await overview.charts(
      [
        { ref: xChartRef, title: 'X̄ (Subgroup Average) Chart' },
        { ref: rChartRef, title: 'S (Standard Deviation) Chart' },
      ],
      { widthCm: 17, heightCm: 8 }
    );

    if (result.Cp !== null || result.Ppk !== null) {
      overview.sectionHeading('Process Capability');
      overview.table({
        headers: [
          { header: 'Metric', key: 'metric', align: 'left', width: 26 },
          { header: 'Value', key: 'value', align: 'right', numFmt: '0.0000' },
        ],
        rows: [
          { metric: 'Cp', value: result.Cp ?? '—' },
          { metric: 'Cpk', value: result.Cpk ?? '—' },
          { metric: 'Pp', value: result.Pp ?? '—' },
          { metric: 'Ppk', value: result.Ppk ?? '—' },
          { metric: 'Sigma Level (Z.Bench, ST)', value: result.sigLvl_st ?? '—' },
        ],
      });

      overview.sectionHeading('Defect Rate (PPM)');
      overview.table({
        headers: [
          { header: 'Metric', key: 'metric', align: 'left', width: 26 },
          { header: 'PPM', key: 'ppm', align: 'right', numFmt: '#,##0.0' },
        ],
        rows: [
          { metric: 'Total PPM (Short-term)', ppm: result.ppmD_st ? result.ppmD_st.total : '—' },
        ],
      });

      await overview.charts([{ ref: histChartRef, title: 'Capability Histogram' }], { widthCm: 17, heightCm: 8 });
    }

    if (result.violations_x.length > 0) {
      overview.sectionHeading('Rule Violations');
      overview.table({
        headers: [
          { header: 'Rule', key: 'rule', align: 'left', width: 10 },
          { header: 'Description', key: 'desc', align: 'left', width: 40 },
          { header: 'Points', key: 'points', align: 'left' },
        ],
        rows: result.violations_x.map((v) => ({ rule: `#${v.rule}`, desc: v.label, points: v.points.join('–') })),
        rowTones: result.violations_x.map(() => 'warning' as const),
      });
    }

    const dataSheet = report.addSheet('Data');
    dataSheet.sectionHeading('Subgroups, X̄ & S');
    dataSheet.table({
      headers: [
        { header: 'Subgroup', key: 'sg', align: 'right' },
        ...subgroups[0].map((_, i) => ({ header: `Value ${i + 1}`, key: `v${i}`, align: 'right' as const, numFmt: '0.0000' })),
        { header: 'X̄', key: 'xbar', align: 'right', numFmt: '0.0000' },
        { header: 'StdDev', key: 'sdev', align: 'right', numFmt: '0.0000' },
      ],
      rows: subgroups.map((row, i) => {
        const r: Record<string, string | number> = { sg: i + 1, xbar: result.xbarVals[i], sdev: result.rangeVals[i] ?? '' }
        row.forEach((v, j) => { r[`v${j}`] = v })
        return r
      }),
      zebra: true,
    });
    dataSheet.freezeHeader(2);

    await report.download('xbar-s-chart.xlsx');
  }

  // ── Export: PNG ─────────────────────────────────────────────────────
  function exportPNG() {
    if (!isLoggedIn) { goToLogin('xbar_s', 'png'); return }
    if (!result || !subgroups) return;
    const width = 700;
    const rowH = 22;
    const height = 140 + rowH * (subgroups.length + 1) + 20;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0A1120';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(messages.pdfReportTitle, 16, 34);
    ctx.fillStyle = '#6b89b4';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, 16, 54);
    ctx.fillText(`Grand Mean = ${niceNum(result.cl_x)}   UCL = ${niceNum(result.ucl_x)}   LCL = ${niceNum(result.lcl_x)}`, 16, 74);

    let y = 100;
    ctx.fillStyle = '#1e2d40';
    ctx.fillRect(16, y, width - 32, rowH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const headers = ['Subgroup', 'X̄', 'S'];
    const colX = [24, 160, 320];
    headers.forEach((h, i) => ctx.fillText(h, colX[i], y + 16));
    y += rowH;

    ctx.font = '12px system-ui, sans-serif';
    subgroups.forEach((_, i) => {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(16, y, width - 32, rowH);
      }
      ctx.fillStyle = '#e2e8f0';
      const cells = [String(i + 1), niceNum(result.xbarVals[i], 3), niceNum(result.rangeVals[i], 3)];
      cells.forEach((val, ci) => ctx.fillText(val, colX[ci], y + 16));
      y += rowH;
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xbar-s-chart.png';
    a.click();
  }

  // ── Export: PDF ─────────────────────────────────────────────────────
  function runExportPDF() {
    if (!isPro) { goToPricing('xbar_s', 'pdf'); return }
    if (!result || !subgroups) return;

    const ctx = createPdfReport(messages.pdfReportTitle, 'xbar_s');

    calloutBox(
      ctx,
      `Grand Mean = ${niceNum(result.cl_x)}   |   k = ${subgroups.length} subgroups   |   n = ${subgroupSize}`,
      'info'
    );

    addChartImage(ctx, xChartRef.current, 'X\u0304 (Subgroup Average) Chart');
    addChartImage(ctx, rChartRef.current, 'S (Standard Deviation) Chart');

    const limitRows: KVRow[] = [
      ['X\u0304 CL', niceNum(result.cl_x)],
      ['X\u0304 UCL', niceNum(result.ucl_x)],
      ['X\u0304 LCL', niceNum(result.lcl_x)],
      ['S CL', niceNum(result.cl_r)],
      ['S UCL', niceNum(result.ucl_r)],
      ['S LCL', niceNum(result.lcl_r)],
    ];
    const capRows: KVRow[] = [
      ['Cp', niceNum(result.Cp)],
      ['Cpk', niceNum(result.Cpk)],
      ['Pp', niceNum(result.Pp)],
      ['Ppk', niceNum(result.Ppk)],
      ['Sigma Level (ST)', niceNum(result.sigLvl_st)],
      ['Total PPM (ST)', result.ppmD_st ? niceNum(result.ppmD_st.total, 1) : '—'],
    ];
    twoColumnTables(ctx, 'Control Limits', limitRows, 'Process Capability', capRows);

    const useCpk = result.isNormal && result.Cpk !== null;
    const cpkVal = useCpk ? result.Cpk : result.Ppk;
    if (cpkVal !== null && (result.LSL !== null || result.USL !== null)) {
      const cls = classifyCapability(cpkVal);
      classificationBanner(ctx, cls);
      capabilityGauge(ctx, {
        title: 'Capability Classification Gauge',
        value: cpkVal,
        caption: `${useCpk ? 'Cpk' : 'Ppk'} = ${niceNum(cpkVal)}`,
      });
    }

    addChartImage(ctx, histChartRef.current, messages.histogramTitle);

    const stable = result.violations_x.length === 0;
    calloutBox(
      ctx,
      stable
        ? 'No Nelson Rule violations were detected on the X\u0304 chart.'
        : `${result.violations_x.length} Nelson Rule violation(s) were detected on the X\u0304 chart — see the table below.`,
      stable ? 'good' : 'warn'
    );

    if (result.violations_x.length > 0) {
      dataTable(
        ctx,
        'Rule Violations',
        [
          { header: 'RULE', width: 60 },
          { header: 'DESCRIPTION', width: 260 },
          { header: 'POINTS', width: ctx.pageWidth - ctx.margin * 2 - 320 },
        ],
        result.violations_x.map((v) => [`#${v.rule}`, v.label, v.points.join('–')])
      );
    }

    dataTable(
      ctx,
      'Data',
      [
        { header: 'SUBGROUP', width: 90, align: 'right' },
        { header: 'X\u0304', width: 120, align: 'right' },
        { header: 'S', width: ctx.pageWidth - ctx.margin * 2 - 210, align: 'right' },
      ],
      subgroups.map((_, i) => [String(i + 1), niceNum(result.xbarVals[i], 3), niceNum(result.rangeVals[i], 3)]),
      {
        cellColors: subgroups.map((_, i) => [
          null,
          violatedIndices.has(i) ? REPORT_COLORS.warn : null,
          null,
        ]),
      }
    );

    if (cpkVal !== null && (result.LSL !== null || result.USL !== null)) {
      criteriaReferenceTable(ctx);
    }

    finalizeReport(ctx);
    ctx.pdf.save('xbar-s-chart.pdf');
  }

  // Pro exports read each chart canvas via toBase64Image(); the watermark
  // (kept on the live view for everyone) is switched off just for that call.
  const exportExcel = () => withWatermarksDisabled([xChartRef.current, rChartRef.current, histChartRef.current], runExportExcel);
  const exportPDF = () => withWatermarksDisabled([xChartRef.current, rChartRef.current, histChartRef.current], runExportPDF);

  // ── Layout (no effect on any calculation) ───────────────────────────────
  const { t } = useLanguage();
  const compactSave = useCompactSave();
  const hasSpec = !!result && (result.LSL !== null || result.USL !== null);
  const verdict = result ? capabilityVerdict(result, t) : null;
  const reason = result ? capabilityReasonFor(result, appliedLimits.target, t) : null;
  const signals: ViolationItem[] = result
    ? [
        ...result.violations_x.map((v) => ({ ...v, chart: messages.chartXTitle })),
        ...result.violations_r.map((v) => ({ ...v, chart: messages.chartSTitle })),
      ]
    : [];
  const capColor = (v: number | null) => (v === null ? 'var(--qh-text)' : v >= 1.33 ? 'var(--qh-good)' : v >= 1.0 ? 'var(--qh-amber)' : 'var(--qh-danger)');

  function analyze() {
    if (runAnalysis()) setMobileTab('results');
  }
  // Runs once after "Try an example" has put the example data in place
  useEffect(() => {
    if (!exampleQueued.current) return;
    exampleQueued.current = false;
    analyze();
  });
  // Charts drawn while their tab was hidden need a resize when it shows
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      for (const r of [xChartRef, rChartRef, histChartRef]) r.current?.resize();
    });
    return () => cancelAnimationFrame(id);
  }, [mobileTab, result]);

  function changeSize(next: number) {
    const size = Math.max(2, Math.min(25, Math.floor(next) || 2));
    setSgSize(size);
    setGrid((prev) => prev.map((r) => (r.length >= size ? r.slice(0, size) : [...r, ...Array(size - r.length).fill('')])));
  }

  const helpSteps = [
    { t: t('xr_help_s1_t'), d: t('xs_help_s1_d') },
    { t: t('xr_help_s2_t'), d: t('xr_help_s2_d') },
    { t: t('spc_help_s3_t'), d: t('spc_help_s3_d') },
    { t: t('spc_help_s5_t'), d: t('spc_help_s5_d') },
    { t: t('xr_help_s5_t'), d: t('xs_help_s5_d') },
    { t: t('spc_help_s6_t'), d: t('spc_help_s6_d') },
  ];

  return (
    <div style={s.page}>
      <ToolStyles />
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_xbar_s" />

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
        <ToolSidebar current="/xbar-s-chart" />

        <div className="tl-main">
          <ToolHeader title={t('xbar_s_title')} intro={t('xs_intro')} onHelp={() => setHelpOpen(true)} onExample={loadExample} />
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} title={t('xs_help_title')} steps={helpSteps} onExample={loadExample} />
          <PhoneTabs tab={mobileTab} onTab={setMobileTab} dataCount={grid.length} />

          <div className="tl-top">
            {/* ── SETUP ──────────────────────────────────────────────────── */}
            <section className="tl-panel tl-setup tl-card" data-active={mobileTab === 'setup'} aria-label={t('spc_tab_setup')}>
              <div>
                <div className="tl-label">{t('spc_subgroup_size')}</div>
                <input className="tl-input" type="number" min={2} max={25} value={sgSize} onChange={(e) => changeSize(Number(e.target.value))} />
                <div className="tl-hint">{t('xs_n_hint')}</div>
              </div>
              <SpecLimits lsl={lsl} target={target} usl={usl} onLsl={setLsl} onTarget={setTarget} onUsl={setUsl} />
              <div className="tl-setup-analyze">
                <button className="tl-analyze" onClick={analyze}>{t('spc_analyze_btn')}</button>
              </div>
            </section>

            <div className="tl-col">
              {/* ── DATA ─────────────────────────────────────────────────── */}
              <section className="tl-panel tl-data tl-card" data-active={mobileTab === 'data'} aria-label={t('spc_tab_data')}>
                <DataCardHead
                  countLabel={t('spc_subgroups_count').replace('{n}', String(grid.length))}
                  onUpload={gridImport.openFilePicker}
                  onClear={clearData}
                  extra={<gridImport.FileInput />}
                />
                {gridImport.fileError && <div className="tl-error" style={{ marginBottom: 10 }}>{gridImport.fileError}</div>}
                <SheetPicker
                  sheetNames={gridImport.sheetNames}
                  activeSheet={gridImport.activeSheet}
                  onSelect={gridImport.selectSheet}
                  accentColor={c.accent}
                  textColor={c.text}
                  mutedColor={c.muted}
                  borderColor={c.border}
                />
                <SubgroupTable
                  rows={grid}
                  n={sgSize}
                  onChange={(r, col, v) => setGrid((prev) => prev.map((row, i) => (i === r ? Array.from({ length: sgSize }, (_, k) => (k === col ? v : row[k] ?? '')) : row)))}
                  onRemove={(r) => setGrid((prev) => prev.filter((_, i) => i !== r))}
                  onAdd={() => setGrid((prev) => [...prev, Array(sgSize).fill('')])}
                />
              </section>

              {/* ── RESULTS ──────────────────────────────────────────────── */}
              <section className="tl-panel tl-results" data-active={mobileTab === 'results'} aria-label={t('spc_tab_results')}>
                {result && (
                  <ResultsHead nPoints={result.n} ad={result.ad ?? null} isNormal={result.isNormal} hasSpec={hasSpec}>
                    <ExportRow
                      isPro={isPro}
                      isLoggedIn={isLoggedIn}
                      hasResult={!!result}
                      onCSV={exportCSV}
                      onPNG={exportPNG}
                      onExcel={exportExcel}
                      onPDF={exportPDF}
                      save={
                        <SaveAnalysisButton
                          theme={theme}
                          tool="xbar_s"
                          defaultName={`Xbar-S Chart — ${new Date().toLocaleDateString('en-US')}`}
                          compact={compactSave}
                          getPayload={() => (!subgroups || !result ? null : { input_data: { subgroups, ...appliedLimits }, results: result })}
                        />
                      }
                    />
                  </ResultsHead>
                )}
                {error && <div className="tl-error">{error}</div>}
                {result && <VerdictCards stable={signals.length === 0} nPoints={result.n} nSubgroups={result.xbarVals.length} signals={signals.length} verdict={verdict} reason={reason} />}

                {result && (
                  <>
                    <KpiGrid r={result} hasSpec={hasSpec} pkName={verdict?.pkName ?? null} capColor={capColor} />

                    {/* ── X̄ chart ───────────────────────────────────────── */}
                    <div className="tl-chart">
                      <h3>{messages.chartXTitle}</h3>
                      <div className="tl-chart-sub">CL = {niceNum(result.cl_x, 3)} · UCL = {niceNum(result.ucl_x, 3)} · LCL = {niceNum(result.lcl_x, 3)}</div>
              <div className="tl-chart-inner">
                <Chart
                  ref={xChartRef}
                  type="line"
                  data={{
                    labels: result.xbarVals.map((_, i) => String(i + 1)),
                    datasets: [
                      {
                        label: 'X\u0304',
                        data: result.xbarVals,
                        borderColor: c.data,
                        backgroundColor: c.data,
                        pointBackgroundColor: result.xbarVals.map((_, i) => (violatedIndices.has(i) ? c.danger : c.data)),
                        pointRadius: 4,
                        borderWidth: 2,
                        tension: 0,
                      },
                      {
                        label: 'CL',
                        data: result.xbarVals.map(() => result.cl_x),
                        borderColor: c.muted,
                        borderDash: [2, 2],
                        pointRadius: 0,
                        borderWidth: 1,
                      },
                      {
                        label: 'UCL',
                        data: result.xbarVals.map(() => result.ucl_x),
                        borderColor: c.danger,
                        borderDash: [5, 4],
                        pointRadius: 0,
                        borderWidth: 1.5,
                      },
                      {
                        label: 'LCL',
                        data: result.xbarVals.map(() => result.lcl_x),
                        borderColor: c.danger,
                        borderDash: [5, 4],
                        pointRadius: 0,
                        borderWidth: 1.5,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    devicePixelRatio: 2,
                    layout: watermarkLayout(),
                    plugins: {
                      watermark: watermarkOptions('normal'),
                      legend: {
                        display: true,
                        labels: { color: c.muted, font: { size: 11 }, boxWidth: 14, filter: (item) => item.text === 'X\u0304' },
                      },
                    },
                    scales: {
                      x: { title: { display: true, text: 'Subgroup', color: c.muted }, ticks: { color: c.muted }, grid: { color: c.border } },
                      y: { ticks: { color: c.muted }, grid: { color: c.border } },
                    },
                  }}
                />
              </div>
                    </div>

                    {/* ── S chart ──────────────────────────────────────── */}
                    <div className="tl-chart">
                      <h3>{messages.chartSTitle}</h3>
                      <div className="tl-chart-sub">S̄ = {niceNum(result.cl_r, 3)} · UCL = {niceNum(result.ucl_r, 3)} · LCL = {niceNum(Math.max(0, result.lcl_r), 3)}</div>
              <div className="tl-chart-inner">
                <Chart
                  ref={rChartRef}
                  type="line"
                  data={{
                    labels: result.rangeVals.map((_, i) => String(i + 1)),
                    datasets: [
                      {
                        label: 'S',
                        data: result.rangeVals,
                        borderColor: c.data,
                        backgroundColor: c.data,
                        pointRadius: 4,
                        borderWidth: 2,
                        tension: 0,
                      },
                      {
                        label: 'CL',
                        data: result.rangeVals.map(() => result.cl_r),
                        borderColor: c.muted,
                        borderDash: [2, 2],
                        pointRadius: 0,
                        borderWidth: 1,
                      },
                      {
                        label: 'UCL',
                        data: result.rangeVals.map(() => result.ucl_r),
                        borderColor: c.danger,
                        borderDash: [5, 4],
                        pointRadius: 0,
                        borderWidth: 1.5,
                      },
                      ...(result.lcl_r > 0
                        ? [{
                            label: 'LCL',
                            data: result.rangeVals.map(() => result.lcl_r),
                            borderColor: c.danger,
                            borderDash: [5, 4] as [number, number],
                            pointRadius: 0,
                            borderWidth: 1.5,
                          }]
                        : []),
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    devicePixelRatio: 2,
                    layout: watermarkLayout(),
                    plugins: {
                      watermark: watermarkOptions('normal'),
                      legend: {
                        display: true,
                        labels: { color: c.muted, font: { size: 11 }, boxWidth: 14, filter: (item) => item.text === 'S' },
                      },
                    },
                    scales: {
                      x: { title: { display: true, text: 'Subgroup', color: c.muted }, ticks: { color: c.muted }, grid: { color: c.border } },
                      y: { ticks: { color: c.muted }, grid: { color: c.border } },
                    },
                  }}
                />
              </div>
                    </div>

                    {/* ── Capability histogram ─────────────────────────── */}
                    {histogramData && (
                      <div className="tl-chart">
                        <h3>{messages.histogramTitle}</h3>
                        <div className="tl-chart-sub">{t('tool_hist_sub').replace('{o}', niceNum(result.sdOverall, 3)).replace('{w}', niceNum(result.sigma, 3))}</div>
                <div className="tl-chart-inner">
                  <Chart
                    ref={histChartRef}
                    type="bar"
                    data={{
                      datasets: [
                        {
                          type: 'bar' as const,
                          label: 'Frequency',
                          data: histogramData.binLabels.map((x, i) => ({ x, y: histogramData.binCounts[i] })),
                          backgroundColor: c.data + '80',
                          borderColor: c.data,
                          borderWidth: 1,
                          order: 2,
                        },
                        {
                          type: 'line' as const,
                          label: 'Overall sigma',
                          data: histogramData.curveX.map((x, i) => ({ x, y: histogramData.overallCurve[i] })),
                          borderColor: c.text,
                          borderWidth: 2,
                          pointRadius: 0,
                          tension: 0.3,
                          order: 1,
                        },
                        {
                          type: 'line' as const,
                          label: 'Within sigma',
                          data: histogramData.curveX.map((x, i) => ({ x, y: histogramData.withinCurve[i] })),
                          borderColor: c.line,
                          borderDash: [6, 4],
                          borderWidth: 2,
                          pointRadius: 0,
                          tension: 0.3,
                          order: 1,
                        },
                        ...(result.LSL !== null
                          ? [{
                              type: 'line' as const,
                              label: 'LSL',
                              data: [{ x: result.LSL, y: 0 }, { x: result.LSL, y: histogramData.chartMaxY }],
                              borderColor: c.danger,
                              borderDash: [4, 3] as [number, number],
                              borderWidth: 1.5,
                              pointRadius: 0,
                              tension: 0,
                              order: 0,
                            }]
                          : []),
                        ...(result.USL !== null
                          ? [{
                              type: 'line' as const,
                              label: 'USL',
                              data: [{ x: result.USL, y: 0 }, { x: result.USL, y: histogramData.chartMaxY }],
                              borderColor: c.danger,
                              borderDash: [4, 3] as [number, number],
                              borderWidth: 1.5,
                              pointRadius: 0,
                              tension: 0,
                              order: 0,
                            }]
                          : []),
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      animation: false,
                      devicePixelRatio: 2,
                      layout: watermarkLayout(),
                      plugins: {
                        watermark: watermarkOptions('light'),
                        legend: {
                          display: true,
                          position: 'top',
                          labels: { color: c.muted, font: { size: 11 }, boxWidth: 14 },
                        },
                      },
                      scales: {
                        x: {
                          type: 'linear',
                          title: { display: true, text: 'Measurement value', color: c.muted },
                          ticks: { color: c.muted, callback: (v) => niceNum(Number(v), 3) },
                          grid: { color: c.border },
                          min: histogramData.axisMin,
                          max: histogramData.axisMax,
                        },
                        y: { title: { display: true, text: 'Frequency', color: c.muted }, ticks: { color: c.muted }, grid: { color: c.border }, beginAtZero: true },
                      },
                    }}
                  />
                </div>
                      </div>
                    )}
                    {!hasSpec && <div className="tl-card" style={{ fontSize: 13, color: c.muted }}>{messages.capabilityNeedsLimits}</div>}

                    <AdequacyCard adequacy={result.dataAdequacy} />
                    <ViolationsCard items={signals} allTests={false} />
                  </>
                )}
                {failed && <div className="tl-error">{t(failed === 'rate' ? 'tool_rate_limited' : 'tool_calc_failed')}</div>}
                {!result && !error && !failed && <div className="tl-card tl-empty">{pending ? t('tool_calculating') : t('xr_empty')}</div>}
                <p style={{ fontSize: 11, color: c.muted, opacity: 0.8, margin: 0 }}>{messages.footerNote}</p>
              </section>
            </div>
          </div>
        </div>
      </div>

      <PhoneBar showResultActions={mobileTab === 'results' && !!result} onAnalyze={analyze} onEdit={() => setMobileTab('data')} />
      <PasteToast show={gridImport.pasteToast} label={t('spc_toast')} />
    </div>
  );
}
