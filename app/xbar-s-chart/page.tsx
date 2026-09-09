'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'chart.js/auto';
import { Chart } from 'react-chartjs-2';
import type { Chart as ChartJSInstance } from 'chart.js';
import {
  runXbarSAnalysis,
  type VariableChartResult,
} from '@/lib/spc/calculator';
import { messages as messagesEn } from '@/lib/spc/xbar-s-messages';
import { xbarSMessagesAr } from '@/lib/spc/xbar-s-messages.ar';
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme';
import Nav from '@/components/Nav';
import SaveAnalysisButton from '@/components/SaveAnalysisButton';
import { useSubscription } from '@/lib/useSubscription';
import { goToLogin, goToPricing } from '@/lib/exportGate';
import { useLanguage } from '@/lib/i18n/context';
import { createReport, nowStamp } from '@/lib/excelReport';
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

const EXAMPLE_SUBGROUPS: number[][] = [
  [48.62, 51.17, 50.36, 48.59, 48.73], [49.52, 49.18, 49.99, 51.07, 49.1], [50.59, 51.77, 51.32, 51.8, 48.09],
  [49.25, 51.26, 49.47, 48.73, 51.9], [50.23, 48.43, 49.26, 49.83, 52.65], [52.32, 49.43, 49.75, 50.43, 48.07],
  [50.94, 52.46, 50.61, 49.65, 50.49], [50.69, 49.29, 47.42, 51.02, 52.27], [48.55, 48.59, 49.99, 50.32, 49.25],
  [48.55, 50.76, 49.52, 49.94, 49.68], [52.7, 49.93, 50.31, 51.03, 49.26], [49.82, 52.68, 49.06, 50.58, 49.1],
  [50.79, 52.46, 48.96, 51.75, 50.36], [48.43, 49.76, 50.52, 49.9, 49.18], [49.04, 48.98, 48.56, 49.11, 48.61],
  [49.73, 50.51, 51.7, 49.71, 48.58], [50.53, 50.27, 50.83, 51.02, 50.65], [50.72, 51.15, 50.26, 53.55, 51.67],
  [49.06, 51.13, 50.18, 51.95, 50.47], [50.58, 50.58, 49.31, 50.67, 52.61],
];

function parseSubgroupRows(text: string): number[][] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.map((line) =>
    line.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v))
  );
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

  const [csvText, setCsvText] = useState('');
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

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  function loadExample() {
    setCsvText(EXAMPLE_SUBGROUPS.map((row) => row.join(', ')).join('\n'));
    setLsl('');
    setUsl('');
    setTarget('');
  }

  function clearData() {
    setCsvText('');
    setLsl('');
    setUsl('');
    setTarget('');
    setSubgroups(null);
    setError('');
  }

  function runAnalysis() {
    setError('');
    const rows = parseSubgroupRows(csvText).filter((r) => r.length > 0);

    if (rows.length === 0) {
      setError(messages.errorBadColumn);
      return;
    }
    if (rows.length < 3) {
      setError(messages.errorInsufficientData);
      return;
    }
    const sizes = new Set(rows.map((r) => r.length));
    if (sizes.size > 1) {
      setError(messages.errorInconsistentSubgroupSize);
      return;
    }
    const n = rows[0].length;
    if (n < 2) {
      setError(messages.errorSubgroupTooSmall);
      return;
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
  }

  const subgroupSize = subgroups && subgroups.length > 0 ? subgroups[0].length : 0;

  const result: VariableChartResult | null = useMemo(() => {
    if (!subgroups || subgroupSize < 2) return null;
    return runXbarSAnalysis({
      data: subgroups,
      N: subgroupSize,
      LSL: appliedLimits.lsl,
      USL: appliedLimits.usl,
      target: appliedLimits.target,
      sigmaConvention: 'direct',
    });
  }, [subgroups, subgroupSize, appliedLimits]);

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
  async function exportExcel() {
    if (!isPro) { goToPricing('xbar_s', 'excel'); return }
    if (!result || !subgroups) return;

    const report = createReport({ toolName: 'Xbar-S Chart' });
    const overview = report.addSheet('Xbar-S Summary');
    overview.titleBand('Xbar-S Chart Report', `k = ${subgroups.length} subgroups   |   n = ${subgroupSize}   |   Grand Mean = ${niceNum(result.cl_x)}`);
    overview.metaStrip([['Generated on', nowStamp()]]);

    overview.sectionHeading('Control Limits');
    overview.table({
      headers: ['Chart', 'CL', 'UCL', 'LCL'],
      rows: [
        ['X̄ (Subgroup Average)', niceNum(result.cl_x), niceNum(result.ucl_x), niceNum(result.lcl_x)],
        ['S (Std Dev)', niceNum(result.cl_r), niceNum(result.ucl_r), niceNum(result.lcl_r)],
      ],
    });

    if (result.Cp !== null || result.Ppk !== null) {
      overview.sectionHeading('Process Capability');
      overview.table({
        headers: ['Metric', 'Value'],
        rows: [
          ['Cp', niceNum(result.Cp)],
          ['Cpk', niceNum(result.Cpk)],
          ['Pp', niceNum(result.Pp)],
          ['Ppk', niceNum(result.Ppk)],
          ['Sigma Level (Z.Bench, ST)', niceNum(result.sigLvl_st)],
          ['Total PPM (ST)', result.ppmD_st ? niceNum(result.ppmD_st.total, 1) : '—'],
        ],
      });
    }

    if (result.violations_x.length > 0) {
      overview.sectionHeading('Rule Violations');
      overview.table({
        headers: ['Rule', 'Description', 'Points'],
        rows: result.violations_x.map((v) => [`#${v.rule}`, v.label, v.points.join('–')]),
      });
    }

    const dataSheet = report.addSheet('Data');
    dataSheet.sectionHeading('Subgroups, X̄ & S');
    dataSheet.table({
      headers: [
        { header: 'Subgroup', key: 'sg', align: 'right' },
        ...subgroups[0].map((_, i) => ({ header: `Value ${i + 1}`, key: `v${i}`, align: 'right' as const })),
        { header: 'X̄', key: 'xbar', align: 'right' },
        { header: 'StdDev', key: 'sdev', align: 'right' },
      ],
      rows: subgroups.map((row, i) => [
        i + 1, ...row.map((v) => niceNum(v, 3)), niceNum(result.xbarVals[i], 3), niceNum(result.rangeVals[i], 3),
      ]),
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
    ctx.fillStyle = '#0a0f1e';
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
  function exportPDF() {
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

    const cpkVal = result.Cpk ?? result.Ppk;
    if (cpkVal !== null && (result.LSL !== null || result.USL !== null)) {
      const cls = classifyCapability(cpkVal);
      classificationBanner(ctx, cls);
      capabilityGauge(ctx, {
        title: 'Capability Classification Gauge',
        value: cpkVal,
        caption: `${result.Cpk !== null ? 'Cpk' : 'Ppk'} = ${niceNum(cpkVal)}`,
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

  const dangerText: React.CSSProperties = { fontSize: 13, color: c.danger, marginTop: 8 };

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_xbar_s" />

      {loadedProjectName && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          <div style={{ fontSize: 13, color: c.accent, background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 14px' }}>
            {lang === 'ar' ? `تم تحميل المشروع المحفوظ: ${loadedProjectName}` : `Loaded saved project: ${loadedProjectName}`}
          </div>
        </div>
      )}
      {loadError && (
        <div className="qh-main" style={{ ...s.main, paddingBottom: 0 }}>
          <div style={dangerText}>{loadError}</div>
        </div>
      )}

      <div className="qh-main" style={s.main}>
        <div>
          <p style={{ fontSize: 13, color: c.muted }}>{messages.appSubtitle}</p>
        </div>

        <div style={{ ...s.card, background: c.surface2 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 6 }}>{messages.whatIsTitle}</p>
          <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.6 }}>{messages.whatIsBody}</p>
        </div>

        {/* ── Data input ──────────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.sectionTitle}>{messages.dataSectionTitle}</div>
          <p style={{ fontSize: 12, color: c.muted, marginBottom: 12 }}>{messages.dataSectionHelp}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <div style={s.label}>{messages.csvUploadLabel}</div>
              <input type="file" accept=".csv" onChange={handleFileUpload} style={s.input} />
              <p style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>{messages.csvUploadHint}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button style={s.addBtn} onClick={loadExample}>{messages.loadExampleButton}</button>
              <button style={{ ...s.exportBtn, color: c.muted }} onClick={clearData}>{messages.clearDataButton}</button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={s.label}>{messages.pasteLabel}</div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={messages.pastePlaceholder}
              style={{ ...s.input, minHeight: 140, fontFamily: 'Consolas, monospace', width: '100%' }}
            />
            {subgroupSize > 0 && (
              <p style={{ fontSize: 11, color: c.accent, marginTop: 6 }}>
                {messages.subgroupSizeLabel}: {subgroupSize} — {messages.subgroupSizeHint}
              </p>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={s.label}>{messages.specLimitsTitle}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 6 }}>
              <label>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{messages.lslLabel}</div>
                <input type="number" value={lsl} onChange={(e) => setLsl(e.target.value)} style={s.input} placeholder={messages.optionalHint} />
              </label>
              <label>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{messages.uslLabel}</div>
                <input type="number" value={usl} onChange={(e) => setUsl(e.target.value)} style={s.input} placeholder={messages.optionalHint} />
              </label>
              <label>
                <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{messages.targetLabel}</div>
                <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} style={s.input} placeholder={messages.optionalHint} />
              </label>
            </div>
          </div>

          <button style={{ ...s.addBtn, marginTop: 14 }} onClick={runAnalysis}>
            {messages.runAnalysisButton}
          </button>
          {error && <p style={dangerText}>{error}</p>}
        </div>

        {/* ── Results ─────────────────────────────────────────────────── */}
        {result && subgroups && (
          <>
            <div style={s.card}>
              <div style={s.sectionTitle}>{messages.resultsTitle}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.cl_x)}</div><div style={s.statLabel}>{messages.metricGrandMean}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.sigma)}</div><div style={s.statLabel}>{messages.metricSigma}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.ucl_x)}</div><div style={s.statLabel}>{messages.metricUCL}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.lcl_x)}</div><div style={s.statLabel}>{messages.metricLCL}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{subgroupSize}</div><div style={s.statLabel}>{messages.metricN}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{subgroups.length}</div><div style={s.statLabel}>{messages.metricSubgroups}</div></div>
              </div>
            </div>

            {/* ── X-bar chart ─────────────────────────────────────────── */}
            <div style={s.chartWrap}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 10 }}>{messages.chartXTitle}</h3>
              <div style={s.chartInner}>
                <Chart
                  ref={xChartRef}
                  type="line"
                  data={{
                    labels: result.xbarVals.map((_, i) => String(i + 1)),
                    datasets: [
                      {
                        label: 'X\u0304',
                        data: result.xbarVals,
                        borderColor: c.line,
                        backgroundColor: c.accent,
                        pointBackgroundColor: result.xbarVals.map((_, i) => (violatedIndices.has(i) ? c.danger : c.accent)),
                        pointRadius: 4,
                        borderWidth: 1.5,
                        tension: 0,
                      },
                      {
                        label: 'CL',
                        data: result.xbarVals.map(() => result.cl_x),
                        borderColor: c.muted,
                        borderDash: [5, 3],
                        pointRadius: 0,
                        borderWidth: 1,
                      },
                      {
                        label: 'UCL',
                        data: result.xbarVals.map(() => result.ucl_x),
                        borderColor: c.danger,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        borderWidth: 1,
                      },
                      {
                        label: 'LCL',
                        data: result.xbarVals.map(() => result.lcl_x),
                        borderColor: c.danger,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    devicePixelRatio: 2,
                    plugins: {
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

            {/* ── S chart ─────────────────────────────────────────────── */}
            <div style={s.chartWrap}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 10 }}>{messages.chartSTitle}</h3>
              <div style={s.chartInner}>
                <Chart
                  ref={rChartRef}
                  type="line"
                  data={{
                    labels: result.rangeVals.map((_, i) => String(i + 1)),
                    datasets: [
                      {
                        label: 'S',
                        data: result.rangeVals,
                        borderColor: c.line,
                        backgroundColor: c.accent,
                        pointRadius: 4,
                        borderWidth: 1.5,
                        tension: 0,
                      },
                      {
                        label: 'CL',
                        data: result.rangeVals.map(() => result.cl_r),
                        borderColor: c.muted,
                        borderDash: [5, 3],
                        pointRadius: 0,
                        borderWidth: 1,
                      },
                      {
                        label: 'UCL',
                        data: result.rangeVals.map(() => result.ucl_r),
                        borderColor: c.danger,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        borderWidth: 1,
                      },
                      ...(result.lcl_r > 0
                        ? [{
                            label: 'LCL',
                            data: result.rangeVals.map(() => result.lcl_r),
                            borderColor: c.danger,
                            borderDash: [3, 3] as [number, number],
                            pointRadius: 0,
                            borderWidth: 1,
                          }]
                        : []),
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    devicePixelRatio: 2,
                    plugins: {
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

            {/* ── Violations ──────────────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.sectionTitle}>{messages.violationsTitle}</div>
              {result.violations_x.length === 0 ? (
                <p style={{ fontSize: 13, color: c.text }}>{messages.noViolations}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.violations_x.map((v, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: c.surface2, border: `1px solid ${c.border}` }}>
                      <span style={{ fontWeight: 700, color: c.danger }}>{messages.ruleLabel} #{v.rule}</span>
                      <span style={{ marginInlineStart: 8, color: c.text }}>{v.label}</span>
                      <span style={{ marginInlineStart: 8, fontSize: 12, color: c.muted }}>
                        {messages.pointsAffected}: {v.points.join('–')}
                      </span>
                      <p style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>{v.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Capability ──────────────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.sectionTitle}>{messages.capabilityTitle}</div>
              {result.Cp === null && result.Ppk === null ? (
                <p style={{ fontSize: 13, color: c.muted }}>{messages.capabilityNeedsLimits}</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
                  <div style={s.statCard}><div style={s.statVal}>{niceNum(result.Cp)}</div><div style={s.statLabel}>{messages.metricCp}</div></div>
                  <div style={s.statCard}><div style={s.statVal}>{niceNum(result.Cpk)}</div><div style={s.statLabel}>{messages.metricCpk}</div></div>
                  <div style={s.statCard}><div style={s.statVal}>{niceNum(result.Pp)}</div><div style={s.statLabel}>{messages.metricPp}</div></div>
                  <div style={s.statCard}><div style={s.statVal}>{niceNum(result.Ppk)}</div><div style={s.statLabel}>{messages.metricPpk}</div></div>
                  <div style={s.statCard}><div style={s.statVal}>{niceNum(result.sigLvl_st)}</div><div style={s.statLabel}>{messages.metricSigmaLevel}</div></div>
                  <div style={s.statCard}><div style={s.statVal}>{result.ppmD_st ? niceNum(result.ppmD_st.total, 1) : '—'}</div><div style={s.statLabel}>{messages.metricPpmTotal}</div></div>
                </div>
              )}
              {result.ad && (
                <p style={{ fontSize: 12, color: c.muted, marginTop: 14 }}>
                  {messages.normalityNote(niceNum(result.ad.p, 3), result.ad.normal)}
                </p>
              )}
              <p style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>
                {messages.dataAdequacyNote(result.dataAdequacy.label, result.dataAdequacy.n)}
              </p>
            </div>

            {/* ── Capability Histogram ────────────────────────────────── */}
            {histogramData && (
              <div style={s.chartWrap}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 4 }}>{messages.histogramTitle}</h3>
                <p style={{ fontSize: 12, color: c.muted, marginBottom: 10 }}>
                  Overall sigma ({niceNum(result.sdOverall)}) and Within sigma ({niceNum(result.sigma)}) are both shown against the raw measurement distribution.
                </p>
                <div style={s.chartInner}>
                  <Chart
                    ref={histChartRef}
                    type="bar"
                    data={{
                      datasets: [
                        {
                          type: 'bar' as const,
                          label: 'Frequency',
                          data: histogramData.binLabels.map((x, i) => ({ x, y: histogramData.binCounts[i] })),
                          backgroundColor: c.accent + '80',
                          borderColor: c.accent,
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
                      plugins: {
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

            {/* ── Export & Save ─────────────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.sectionTitle}>{messages.exportSectionTitle}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                <button style={s.exportBtn} onClick={exportCSV}>
                  {isLoggedIn ? '📄' : '🔒'} {messages.exportCsvButton}
                </button>
                <button style={s.exportBtn} onClick={exportExcel}>
                  {isPro ? `📊 ${messages.exportExcelButton}` : `🔒 ${messages.exportExcelButton} (Pro)`}
                </button>
                <button style={s.exportBtn} onClick={exportPNG}>
                  {isLoggedIn ? '🖼️' : '🔒'} {messages.exportPngButton}
                </button>
                <button style={s.exportBtn} onClick={exportPDF}>
                  {isPro ? `📕 ${messages.exportPdfButton}` : `🔒 ${messages.exportPdfButton} (Pro)`}
                </button>
              </div>
              <div style={{ marginTop: 10 }}>
                <SaveAnalysisButton
                  theme={theme}
                  tool="xbar_r"
                  defaultName={`Xbar-S Chart — ${new Date().toLocaleDateString('en-US')}`}
                  getPayload={() =>
                    !subgroups || !result
                      ? null
                      : { input_data: { subgroups, ...appliedLimits }, results: result }
                  }
                />
              </div>
            </div>
          </>
        )}

        <p style={{ fontSize: 11, color: c.muted, opacity: 0.7 }}>{messages.footerNote}</p>
      </div>
    </div>
  );
}
