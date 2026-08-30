'use client';

import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import {
  runVariableChartAnalysis,
  validateVariableData,
  type VariableChartResult,
  type VariableChartError,
} from '@/lib/spc/calculator';
import { messages as messagesEn } from '@/lib/spc/imr-messages';
import { imrMessagesAr } from '@/lib/spc/imr-messages.ar';
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

const EXAMPLE_DATA = [10.2, 10.5, 9.8, 10.1, 10.6, 9.9, 10.3, 10.0, 10.4, 9.7, 10.1, 10.3, 9.9, 10.2, 10.0, 10.5, 9.8, 10.3, 10.1, 9.9, 10.2, 10.4, 10.0, 9.8, 10.3];

function parseLines(text: string): string[] {
  return text.split(/\r?\n|,/).map((l) => l.trim()).filter((l) => l.length > 0);
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

export default function ImrChartPage() {
  const [theme, setTheme] = usePersistedTheme();
  const { lang } = useLanguage();
  const messages = lang === 'ar' ? imrMessagesAr : messagesEn;
  const c = COLORS[theme];
  const s = getSharedStyles(theme);
  const { isPro, isLoggedIn } = useSubscription();

  const [csvText, setCsvText] = useState('');
  const [lsl, setLsl] = useState('');
  const [usl, setUsl] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const [values, setValues] = useState<number[] | null>(null);
  const [appliedLimits, setAppliedLimits] = useState<{ lsl: number | null; usl: number | null; target: number | null }>({ lsl: null, usl: null, target: null });
  const [loadedProjectName, setLoadedProjectName] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    fetch(`/api/saved-analyses/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const data = analysis.input_data as { values: number[]; lsl: number | null; usl: number | null; target: number | null };
        setValues(data.values);
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
    setCsvText(EXAMPLE_DATA.join('\n'));
    setLsl('');
    setUsl('');
    setTarget('');
  }

  function clearData() {
    setCsvText('');
    setLsl('');
    setUsl('');
    setTarget('');
    setValues(null);
    setError('');
  }

  function runAnalysis() {
    setError('');
    const lines = parseLines(csvText);
    const parsed: number[] = [];
    for (const line of lines) {
      const v = Number(line);
      if (Number.isFinite(v)) parsed.push(v);
    }

    const validationError: VariableChartError | null = validateVariableData(parsed.map((v) => [v]));
    if (validationError === 'insufficient-data') {
      setError(messages.errorInsufficientData);
      return;
    }
    if (parsed.length === 0) {
      setError(messages.errorBadColumn);
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
    setValues(parsed);
  }

  const result: VariableChartResult | null = useMemo(() => {
    if (!values) return null;
    return runVariableChartAnalysis({
      data: values.map((v) => [v]),
      N: 1,
      LSL: appliedLimits.lsl,
      USL: appliedLimits.usl,
      target: appliedLimits.target,
      sigmaConvention: 'direct',
    });
  }, [values, appliedLimits]);

  const iChartGeom = useMemo(() => {
    if (!result) return null;
    return lineChartGeom(result.xbarVals, [result.ucl_x, result.lcl_x, result.cl_x]);
  }, [result]);

  const mrChartGeom = useMemo(() => {
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
    if (!isLoggedIn) { goToLogin('imr', 'csv'); return }
    if (!result) return;
    const header = 'Index,Value,MovingRange\n';
    const body = result.xbarVals
      .map((v, i) => [i + 1, v, result.rangeVals[i] ?? ''].join(','))
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'imr-chart.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export: Excel ────────────────────────────────────────────────────
  async function exportExcel() {
    if (!isPro) { goToPricing('imr', 'excel'); return }
    if (!result) return;

    const report = createReport({ toolName: 'I-MR Chart' });
    const overview = report.addSheet('I-MR Summary');
    overview.titleBand('I-MR Chart Report', `N = ${result.n}   |   Mean = ${niceNum(result.cl_x)}   |   σ = ${niceNum(result.sigma)}`);
    overview.metaStrip([['Generated on', nowStamp()]]);

    overview.sectionHeading('Control Limits');
    overview.table({
      headers: ['Chart', 'CL', 'UCL', 'LCL'],
      rows: [
        ['Individuals (I)', niceNum(result.cl_x), niceNum(result.ucl_x), niceNum(result.lcl_x)],
        ['Moving Range (MR)', niceNum(result.cl_r), niceNum(result.ucl_r), niceNum(result.lcl_r)],
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
    dataSheet.sectionHeading('Individuals & Moving Range');
    dataSheet.table({
      headers: [
        { header: '#', key: 'i', align: 'right' },
        { header: 'Value', key: 'val', align: 'right' },
        { header: 'Moving Range', key: 'mr', align: 'right' },
      ],
      rows: result.xbarVals.map((v, i) => [i + 1, niceNum(v, 3), result.rangeVals[i] !== null ? niceNum(result.rangeVals[i], 3) : '']),
      zebra: true,
    });
    dataSheet.freezeHeader(2);

    await report.download('imr-chart.xlsx');
  }

  // ── Export: PNG ─────────────────────────────────────────────────────
  function exportPNG() {
    if (!isLoggedIn) { goToLogin('imr', 'png'); return }
    if (!result) return;
    const width = 700;
    const rowH = 22;
    const height = 140 + rowH * (result.xbarVals.length + 1) + 20;
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
    ctx.fillText(`Mean = ${niceNum(result.cl_x)}   UCL = ${niceNum(result.ucl_x)}   LCL = ${niceNum(result.lcl_x)}`, 16, 74);

    let y = 100;
    ctx.fillStyle = '#1e2d40';
    ctx.fillRect(16, y, width - 32, rowH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const headers = ['#', 'Value', 'Moving Range'];
    const colX = [24, 120, 260];
    headers.forEach((h, i) => ctx.fillText(h, colX[i], y + 16));
    y += rowH;

    ctx.font = '12px system-ui, sans-serif';
    result.xbarVals.forEach((v, i) => {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(16, y, width - 32, rowH);
      }
      ctx.fillStyle = '#e2e8f0';
      const cells = [String(i + 1), niceNum(v, 3), result.rangeVals[i] !== null ? niceNum(result.rangeVals[i], 3) : ''];
      cells.forEach((val, ci) => ctx.fillText(val, colX[ci], y + 16));
      y += rowH;
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'imr-chart.png';
    a.click();
  }

  // ── Export: PDF ─────────────────────────────────────────────────────
  function exportPDF() {
    if (!isPro) { goToPricing('imr', 'pdf'); return }
    if (!result) return;
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
    pdf.text(`Mean = ${niceNum(result.cl_x)}   UCL = ${niceNum(result.ucl_x)}   LCL = ${niceNum(result.lcl_x)}   N = ${result.n}`, margin, y);
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
      ['Individuals (I)', niceNum(result.cl_x), niceNum(result.ucl_x), niceNum(result.lcl_x)],
      ['Moving Range (MR)', niceNum(result.cl_r), niceNum(result.ucl_r), niceNum(result.lcl_r)],
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
    const dataColX = [margin, margin + 60, margin + 180];
    const drawDataHeader = () => {
      pdf.setFillColor(230, 230, 230);
      pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      ['#', 'Value', 'Moving Range'].forEach((h, i) => pdf.text(h, dataColX[i] + 4, y + 13));
      y += rowHeight;
    };
    drawDataHeader();
    pdf.setFont('helvetica', 'normal');
    result.xbarVals.forEach((v, i) => {
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
        drawDataHeader();
      }
      const cells = [String(i + 1), niceNum(v, 3), result.rangeVals[i] !== null ? niceNum(result.rangeVals[i], 3) : ''];
      cells.forEach((val, i2) => pdf.text(val, dataColX[i2] + 4, y + 13));
      y += rowHeight;
    });

    pdf.save('imr-chart.pdf');
  }

  const dangerText: React.CSSProperties = { fontSize: 13, color: c.danger, marginTop: 8 };

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_imr" />

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
              style={{ ...s.input, minHeight: 120, fontFamily: 'Consolas, monospace', width: '100%' }}
            />
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
        {result && iChartGeom && mrChartGeom && (
          <>
            <div style={s.card}>
              <div style={s.sectionTitle}>{messages.resultsTitle}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.cl_x)}</div><div style={s.statLabel}>{messages.metricMean}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.sigma)}</div><div style={s.statLabel}>{messages.metricSigma}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.ucl_x)}</div><div style={s.statLabel}>{messages.metricUCL}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.lcl_x)}</div><div style={s.statLabel}>{messages.metricLCL}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{result.n}</div><div style={s.statLabel}>{messages.metricN}</div></div>
              </div>
            </div>

            {/* ── I chart ─────────────────────────────────────────────── */}
            <div style={s.chartWrap}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 10 }}>{messages.chartITitle}</h3>
              <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={messages.chartITitle}>
                <line x1={PAD.left} y1={iChartGeom.yFor(result.cl_x)} x2={CHART_W - PAD.right} y2={iChartGeom.yFor(result.cl_x)} stroke={c.muted} strokeDasharray="5 3" />
                <line x1={PAD.left} y1={iChartGeom.yFor(result.ucl_x)} x2={CHART_W - PAD.right} y2={iChartGeom.yFor(result.ucl_x)} stroke={c.danger} strokeDasharray="3 3" opacity={0.7} />
                <line x1={PAD.left} y1={iChartGeom.yFor(result.lcl_x)} x2={CHART_W - PAD.right} y2={iChartGeom.yFor(result.lcl_x)} stroke={c.danger} strokeDasharray="3 3" opacity={0.7} />
                <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={CHART_H - PAD.bottom} stroke={c.border} />
                <line x1={PAD.left} y1={CHART_H - PAD.bottom} x2={CHART_W - PAD.right} y2={CHART_H - PAD.bottom} stroke={c.border} />
                <polyline
                  fill="none"
                  stroke={c.line}
                  strokeWidth={1.5}
                  points={result.xbarVals.map((v, i) => `${iChartGeom.xFor(i)},${iChartGeom.yFor(v)}`).join(' ')}
                />
                {result.xbarVals.map((v, i) => (
                  <circle
                    key={i}
                    cx={iChartGeom.xFor(i)}
                    cy={iChartGeom.yFor(v)}
                    r={4}
                    fill={violatedIndices.has(i) ? c.danger : c.accent}
                  />
                ))}
              </svg>
            </div>

            {/* ── MR chart ────────────────────────────────────────────── */}
            <div style={s.chartWrap}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 10 }}>{messages.chartMRTitle}</h3>
              <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={messages.chartMRTitle}>
                <line x1={PAD.left} y1={mrChartGeom.yFor(result.cl_r)} x2={CHART_W - PAD.right} y2={mrChartGeom.yFor(result.cl_r)} stroke={c.muted} strokeDasharray="5 3" />
                <line x1={PAD.left} y1={mrChartGeom.yFor(result.ucl_r)} x2={CHART_W - PAD.right} y2={mrChartGeom.yFor(result.ucl_r)} stroke={c.danger} strokeDasharray="3 3" opacity={0.7} />
                <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={CHART_H - PAD.bottom} stroke={c.border} />
                <line x1={PAD.left} y1={CHART_H - PAD.bottom} x2={CHART_W - PAD.right} y2={CHART_H - PAD.bottom} stroke={c.border} />
                <polyline
                  fill="none"
                  stroke={c.line}
                  strokeWidth={1.5}
                  points={result.rangeVals
                    .map((v, i) => (v !== null ? `${mrChartGeom.xFor(i)},${mrChartGeom.yFor(v)}` : null))
                    .filter(Boolean)
                    .join(' ')}
                />
                {result.rangeVals.map((v, i) =>
                  v !== null ? <circle key={i} cx={mrChartGeom.xFor(i)} cy={mrChartGeom.yFor(v)} r={4} fill={c.accent} /> : null
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
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
                    <div style={s.statCard}><div style={s.statVal}>{niceNum(result.Cp)}</div><div style={s.statLabel}>{messages.metricCp}</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{niceNum(result.Cpk)}</div><div style={s.statLabel}>{messages.metricCpk}</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{niceNum(result.Pp)}</div><div style={s.statLabel}>{messages.metricPp}</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{niceNum(result.Ppk)}</div><div style={s.statLabel}>{messages.metricPpk}</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{niceNum(result.sigLvl_st)}</div><div style={s.statLabel}>{messages.metricSigmaLevel}</div></div>
                    <div style={s.statCard}><div style={s.statVal}>{result.ppmD_st ? niceNum(result.ppmD_st.total, 1) : '—'}</div><div style={s.statLabel}>{messages.metricPpmTotal}</div></div>
                  </div>
                </>
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
                  tool="imr"
                  defaultName={`I-MR Chart — ${new Date().toLocaleDateString('en-US')}`}
                  getPayload={() =>
                    !values || !result
                      ? null
                      : { input_data: { values, ...appliedLimits }, results: result }
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
