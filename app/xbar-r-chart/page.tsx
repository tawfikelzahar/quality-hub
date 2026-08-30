'use client';

import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import {
  runVariableChartAnalysis,
  type VariableChartResult,
} from '@/lib/spc/calculator';
import { messages as messagesEn } from '@/lib/spc/xbar-r-messages';
import { xbarRMessagesAr } from '@/lib/spc/xbar-r-messages.ar';
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme';
import Nav from '@/components/Nav';
import SaveAnalysisButton from '@/components/SaveAnalysisButton';
import { useSubscription } from '@/lib/useSubscription';
import { goToLogin, goToPricing } from '@/lib/exportGate';
import { useLanguage } from '@/lib/i18n/context';
import { createReport, nowStamp } from '@/lib/excelReport';

const CHART_W = 680;
const CHART_H = 280;
const PAD = { top: 16, right: 20, bottom: 36, left: 56 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

const EXAMPLE_SUBGROUPS: number[][] = [
  [9.86, 10.12, 9.82, 10.46], [9.91, 10.17, 10.28, 10.12], [10.21, 9.86, 10.49, 10.18],
  [9.68, 10.12, 9.82, 10.06], [10.51, 10.13, 9.98, 10.16], [9.91, 10.54, 10.38, 10.12],
  [9.92, 10.01, 10.17, 10.33], [9.64, 9.98, 10.07, 9.82], [10.25, 9.84, 10.13, 10.21],
  [10.14, 10.22, 10.15, 9.99], [10.34, 9.89, 9.8, 10.08], [10.44, 9.66, 9.89, 10.58],
  [10.29, 9.88, 10.22, 10.09], [10.44, 10.04, 10.24, 10.28], [10.5, 10.59, 10.22, 10.18],
  [10.35, 9.75, 9.78, 9.99], [10.2, 10.52, 10.28, 10.33], [9.87, 10.13, 10.08, 10.39],
  [9.98, 9.87, 10.47, 10.55], [9.97, 9.63, 9.9, 10.3],
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

function lineChartGeom(values: (number | null)[], extraLines: number[]) {
  const nums = values.filter((v): v is number => v !== null);
  const all = [...nums, ...extraLines];
  const yMin = Math.min(...all);
  const yMax = Math.max(...all);
  const yPad = (yMax - yMin || 1) * 0.12;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;
  const n = values.length;
  const xFor = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * PLOT_W);
  const yFor = (v: number) => PAD.top + (1 - (v - yLo) / (yHi - yLo || 1)) * PLOT_H;
  return { xFor, yFor, yLo, yHi };
}

export default function XbarRChartPage() {
  const [theme, setTheme] = usePersistedTheme();
  const { lang } = useLanguage();
  const messages = lang === 'ar' ? xbarRMessagesAr : messagesEn;
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
    return runVariableChartAnalysis({
      data: subgroups,
      N: subgroupSize,
      LSL: appliedLimits.lsl,
      USL: appliedLimits.usl,
      target: appliedLimits.target,
      sigmaConvention: 'direct',
    });
  }, [subgroups, subgroupSize, appliedLimits]);

  const xChartGeom = useMemo(() => {
    if (!result) return null;
    return lineChartGeom(result.xbarVals, [result.ucl_x, result.lcl_x, result.cl_x]);
  }, [result]);

  const rChartGeom = useMemo(() => {
    if (!result) return null;
    return lineChartGeom(result.rangeVals, [result.ucl_r, result.lcl_r, result.cl_r]);
  }, [result]);

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

  // ── Export: CSV ─────────────────────────────────────────────────────
  function exportCSV() {
    if (!isLoggedIn) { goToLogin('xbar_r', 'csv'); return }
    if (!result || !subgroups) return;
    const header = `Subgroup,${subgroups[0].map((_, i) => `Value${i + 1}`).join(',')},XBar,Range\n`;
    const body = subgroups
      .map((row, i) => [i + 1, ...row, result.xbarVals[i], result.rangeVals[i]].join(','))
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xbar-r-chart.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export: Excel ────────────────────────────────────────────────────
  async function exportExcel() {
    if (!isPro) { goToPricing('xbar_r', 'excel'); return }
    if (!result || !subgroups) return;

    const report = createReport({ toolName: 'Xbar-R Chart' });
    const overview = report.addSheet('Xbar-R Summary');
    overview.titleBand('Xbar-R Chart Report', `k = ${subgroups.length} subgroups   |   n = ${subgroupSize}   |   Grand Mean = ${niceNum(result.cl_x)}`);
    overview.metaStrip([['Generated on', nowStamp()]]);

    overview.sectionHeading('Control Limits');
    overview.table({
      headers: ['Chart', 'CL', 'UCL', 'LCL'],
      rows: [
        ['X̄ (Subgroup Average)', niceNum(result.cl_x), niceNum(result.ucl_x), niceNum(result.lcl_x)],
        ['R (Range)', niceNum(result.cl_r), niceNum(result.ucl_r), niceNum(result.lcl_r)],
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
    dataSheet.sectionHeading('Subgroups, X̄ & Range');
    dataSheet.table({
      headers: [
        { header: 'Subgroup', key: 'sg', align: 'right' },
        ...subgroups[0].map((_, i) => ({ header: `Value ${i + 1}`, key: `v${i}`, align: 'right' as const })),
        { header: 'X̄', key: 'xbar', align: 'right' },
        { header: 'Range', key: 'range', align: 'right' },
      ],
      rows: subgroups.map((row, i) => [
        i + 1, ...row.map((v) => niceNum(v, 3)), niceNum(result.xbarVals[i], 3), niceNum(result.rangeVals[i], 3),
      ]),
      zebra: true,
    });
    dataSheet.freezeHeader(2);

    await report.download('xbar-r-chart.xlsx');
  }

  // ── Export: PNG ─────────────────────────────────────────────────────
  function exportPNG() {
    if (!isLoggedIn) { goToLogin('xbar_r', 'png'); return }
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
    const headers = ['Subgroup', 'X̄', 'Range'];
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
    a.download = 'xbar-r-chart.png';
    a.click();
  }

  // ── Export: PDF ─────────────────────────────────────────────────────
  function exportPDF() {
    if (!isPro) { goToPricing('xbar_r', 'pdf'); return }
    if (!result || !subgroups) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(messages.pdfReportTitle, margin, y);
    y += 18;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100);
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);
    y += 16;
    pdf.setTextColor(0);
    pdf.setFontSize(11);
    pdf.text(`Grand Mean = ${niceNum(result.cl_x)}   k = ${subgroups.length}   n = ${subgroupSize}`, margin, y);
    y += 24;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Control Limits', margin, y);
    y += 8;
    const rowHeight = 18;
    const ctrlColX = [margin, margin + 150, margin + 250, margin + 350];
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
    pdf.setFontSize(9);
    ['Chart', 'CL', 'UCL', 'LCL'].forEach((h, i) => pdf.text(h, ctrlColX[i] + 4, y + 13));
    y += rowHeight;
    pdf.setFont('helvetica', 'normal');
    [
      ['X̄ (Subgroup Avg)', niceNum(result.cl_x), niceNum(result.ucl_x), niceNum(result.lcl_x)],
      ['R (Range)', niceNum(result.cl_r), niceNum(result.ucl_r), niceNum(result.lcl_r)],
    ].forEach((row) => {
      row.forEach((v, i) => pdf.text(v, ctrlColX[i] + 4, y + 13));
      y += rowHeight;
    });
    y += 16;

    if (result.Cp !== null || result.Ppk !== null) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Process Capability', margin, y);
      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const capRows = [
        `Cp = ${niceNum(result.Cp)}    Cpk = ${niceNum(result.Cpk)}`,
        `Pp = ${niceNum(result.Pp)}    Ppk = ${niceNum(result.Ppk)}`,
        `Sigma Level (ST) = ${niceNum(result.sigLvl_st)}    Total PPM (ST) = ${result.ppmD_st ? niceNum(result.ppmD_st.total, 1) : '—'}`,
      ];
      capRows.forEach((line) => { pdf.text(line, margin, y); y += 14; });
      y += 10;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Data', margin, y);
    y += 8;
    const dataColX = [margin, margin + 80, margin + 200];
    const drawDataHeader = () => {
      pdf.setFillColor(230, 230, 230);
      pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      ['Subgroup', 'X̄', 'Range'].forEach((h, i) => pdf.text(h, dataColX[i] + 4, y + 13));
      y += rowHeight;
    };
    drawDataHeader();
    pdf.setFont('helvetica', 'normal');
    subgroups.forEach((_, i) => {
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
        drawDataHeader();
      }
      const cells = [String(i + 1), niceNum(result.xbarVals[i], 3), niceNum(result.rangeVals[i], 3)];
      cells.forEach((val, i2) => pdf.text(val, dataColX[i2] + 4, y + 13));
      y += rowHeight;
    });

    pdf.save('xbar-r-chart.pdf');
  }

  const dangerText: React.CSSProperties = { fontSize: 13, color: c.danger, marginTop: 8 };

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_xbar_r" />

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
        {result && xChartGeom && rChartGeom && subgroups && (
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
              <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={messages.chartXTitle}>
                <line x1={PAD.left} y1={xChartGeom.yFor(result.cl_x)} x2={CHART_W - PAD.right} y2={xChartGeom.yFor(result.cl_x)} stroke={c.muted} strokeDasharray="5 3" />
                <line x1={PAD.left} y1={xChartGeom.yFor(result.ucl_x)} x2={CHART_W - PAD.right} y2={xChartGeom.yFor(result.ucl_x)} stroke={c.danger} strokeDasharray="3 3" opacity={0.7} />
                <line x1={PAD.left} y1={xChartGeom.yFor(result.lcl_x)} x2={CHART_W - PAD.right} y2={xChartGeom.yFor(result.lcl_x)} stroke={c.danger} strokeDasharray="3 3" opacity={0.7} />
                <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={CHART_H - PAD.bottom} stroke={c.border} />
                <line x1={PAD.left} y1={CHART_H - PAD.bottom} x2={CHART_W - PAD.right} y2={CHART_H - PAD.bottom} stroke={c.border} />
                <polyline
                  fill="none"
                  stroke={c.line}
                  strokeWidth={1.5}
                  points={result.xbarVals.map((v, i) => `${xChartGeom.xFor(i)},${xChartGeom.yFor(v)}`).join(' ')}
                />
                {result.xbarVals.map((v, i) => (
                  <circle
                    key={i}
                    cx={xChartGeom.xFor(i)}
                    cy={xChartGeom.yFor(v)}
                    r={4}
                    fill={violatedIndices.has(i) ? c.danger : c.accent}
                  />
                ))}
              </svg>
            </div>

            {/* ── R chart ─────────────────────────────────────────────── */}
            <div style={s.chartWrap}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 10 }}>{messages.chartRTitle}</h3>
              <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={messages.chartRTitle}>
                <line x1={PAD.left} y1={rChartGeom.yFor(result.cl_r)} x2={CHART_W - PAD.right} y2={rChartGeom.yFor(result.cl_r)} stroke={c.muted} strokeDasharray="5 3" />
                <line x1={PAD.left} y1={rChartGeom.yFor(result.ucl_r)} x2={CHART_W - PAD.right} y2={rChartGeom.yFor(result.ucl_r)} stroke={c.danger} strokeDasharray="3 3" opacity={0.7} />
                {result.lcl_r > 0 && (
                  <line x1={PAD.left} y1={rChartGeom.yFor(result.lcl_r)} x2={CHART_W - PAD.right} y2={rChartGeom.yFor(result.lcl_r)} stroke={c.danger} strokeDasharray="3 3" opacity={0.7} />
                )}
                <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={CHART_H - PAD.bottom} stroke={c.border} />
                <line x1={PAD.left} y1={CHART_H - PAD.bottom} x2={CHART_W - PAD.right} y2={CHART_H - PAD.bottom} stroke={c.border} />
                <polyline
                  fill="none"
                  stroke={c.line}
                  strokeWidth={1.5}
                  points={result.rangeVals
                    .map((v, i) => (v !== null ? `${rChartGeom.xFor(i)},${rChartGeom.yFor(v)}` : null))
                    .filter(Boolean)
                    .join(' ')}
                />
                {result.rangeVals.map((v, i) =>
                  v !== null ? <circle key={i} cx={rChartGeom.xFor(i)} cy={rChartGeom.yFor(v)} r={4} fill={c.accent} /> : null
                )}
              </svg>
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
                  defaultName={`Xbar-R Chart — ${new Date().toLocaleDateString('en-US')}`}
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
