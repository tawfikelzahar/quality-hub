'use client';

import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import {
  runMultipleLinearRegression,
  validateData,
  predictAt,
  tCritical95,
  type MultiDataRow,
  type MultiRegressionResult,
  type MultiRegressionError,
} from '@/lib/multiregression/calculator';
import { messages as messagesEn } from '@/lib/multiregression/messages';
import { messagesAr } from '@/lib/multiregression/messages.ar';
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme';
import Nav from '@/components/Nav';
import SaveAnalysisButton from '@/components/SaveAnalysisButton';
import { useSubscription } from '@/lib/useSubscription';
import { goToLogin, goToPricing } from '@/lib/exportGate';
import { useLanguage } from '@/lib/i18n/context';
import { createReport, nowStamp } from '@/lib/excelReport';

const SMALL_CHART_W = 300;
const SMALL_CHART_H = 220;
const SPAD = { top: 12, right: 14, bottom: 32, left: 44 };
const SPLOT_W = SMALL_CHART_W - SPAD.left - SPAD.right;
const SPLOT_H = SMALL_CHART_H - SPAD.top - SPAD.bottom;

const EXAMPLE_CSV = `Speed,Hardness,SurfaceFinish
800,20,3.1
900,45,2.4
1000,25,2.6
1100,50,1.9
1200,30,2.1
1300,55,1.5
1400,35,1.7
1500,60,1.1
1600,40,1.3
1700,65,0.8
1800,45,1.0`;

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(',').map((v) => v.trim()));
  return { headers, rows };
}

function niceNum(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return n === Infinity ? '∞' : '—';
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.001 && n !== 0)) return n.toExponential(3);
  return n.toFixed(digits);
}

function formatP(p: number): string {
  if (p < 0.001) return '< 0.001';
  return p.toFixed(3);
}

function smallChartGeom(xs: number[], ys: number[]) {
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xPad = (xMax - xMin || 1) * 0.1;
  const yPad = (yMax - yMin || 1) * 0.15;
  const xLo = xMin - xPad;
  const xHi = xMax + xPad;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;
  const xFor = (x: number) => SPAD.left + ((x - xLo) / (xHi - xLo || 1)) * SPLOT_W;
  const yFor = (y: number) => SPAD.top + (1 - (y - yLo) / (yHi - yLo || 1)) * SPLOT_H;
  return { xFor, yFor, xLo, xHi, yLo, yHi };
}

function inverseErf(x: number): number {
  const a = 0.147;
  const ln1mx2 = Math.log(1 - x * x);
  const term1 = 2 / (Math.PI * a) + ln1mx2 / 2;
  const term2 = ln1mx2 / a;
  const sign = x < 0 ? -1 : 1;
  return sign * Math.sqrt(Math.sqrt(term1 * term1 - term2) - term1);
}

export default function MultiRegressionPage() {
  const [theme, setTheme] = usePersistedTheme();
  const { lang } = useLanguage();
  const messages = lang === 'ar' ? messagesAr : messagesEn;
  const c = COLORS[theme];
  const s = getSharedStyles(theme);
  const { isPro, isLoggedIn } = useSubscription();

  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [yCol, setYCol] = useState('');
  const [xCols, setXCols] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [dataRows, setDataRows] = useState<MultiDataRow[] | null>(null);
  const [predictorNames, setPredictorNames] = useState<string[]>([]);
  const [predictInputs, setPredictInputs] = useState<Record<string, string>>({});
  const [loadedProjectName, setLoadedProjectName] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    fetch(`/api/saved-analyses/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ analysis }) => {
        const data = analysis.input_data as { rows: MultiDataRow[]; predictorNames: string[]; yCol: string };
        setDataRows(data.rows);
        setPredictorNames(data.predictorNames);
        setYCol(data.yCol);
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
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setCsvText(text);
      readColumns(text);
    };
    reader.readAsText(file);
  }

  function readColumns(text?: string) {
    const { headers: h, rows } = parseCsv(text ?? csvText);
    setHeaders(h);
    setRawRows(rows);
    setError('');
    if (h.length >= 3) {
      setYCol((prev) => (h.includes(prev) ? prev : h[h.length - 1]));
      setXCols((prev) => {
        const valid = prev.filter((p) => h.includes(p));
        return valid.length >= 2 ? valid : h.slice(0, h.length - 1);
      });
    }
  }

  function loadExample() {
    setCsvText(EXAMPLE_CSV);
    readColumns(EXAMPLE_CSV);
  }

  function clearData() {
    setCsvText('');
    setHeaders([]);
    setRawRows([]);
    setYCol('');
    setXCols([]);
    setDataRows(null);
    setPredictorNames([]);
    setError('');
  }

  function togglePredictor(col: string) {
    setXCols((prev) => (prev.includes(col) ? prev.filter((p) => p !== col) : [...prev, col]));
  }

  function runAnalysis() {
    setError('');
    if (!yCol || headers.length === 0) {
      setError(messages.errorBadColumns);
      return;
    }
    if (xCols.length < 2) {
      setError(messages.errorSelectPredictor);
      return;
    }

    const yIdx = headers.indexOf(yCol);
    const xIdxs = xCols.map((col) => headers.indexOf(col));

    const parsed: MultiDataRow[] = [];
    for (const row of rawRows) {
      const yv = Number(row[yIdx]);
      const xvs = xIdxs.map((idx) => Number(row[idx]));
      const yValid = Number.isFinite(yv) && row[yIdx] !== '';
      const xValid = xvs.every((v, i) => Number.isFinite(v) && row[xIdxs[i]] !== '');
      if (yValid && xValid) parsed.push({ y: yv, x: xvs });
    }

    const validationError: MultiRegressionError | null = validateData(parsed, xCols.length);
    if (validationError === 'insufficient-data') { setError(messages.errorInsufficientData); return; }
    if (validationError === 'too-many-predictors') { setError(messages.errorTooManyPredictors); return; }
    if (validationError === 'zero-variance-predictor') { setError(messages.errorZeroVariancePredictor); return; }
    if (validationError === 'zero-variance-y') { setError(messages.errorZeroVarianceY); return; }

    setPredictorNames(xCols);
    setDataRows(parsed);
    setPredictInputs({});
  }

  const result: MultiRegressionResult | null = useMemo(() => {
    if (!dataRows || predictorNames.length === 0) return null;
    try {
      return runMultipleLinearRegression(dataRows, predictorNames);
    } catch {
      setError(messages.errorSingularMatrix);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataRows, predictorNames]);

  const prediction = useMemo(() => {
    if (!result) return null;
    const values = predictorNames.map((name) => Number(predictInputs[name]));
    if (values.some((v) => !Number.isFinite(v))) return null;
    const tCrit = tCritical95(result.dfResidual);
    return predictAt(result, values, tCrit);
  }, [result, predictInputs, predictorNames]);

  // ── Export: CSV ─────────────────────────────────────────────────────
  function exportCSV() {
    if (!isLoggedIn) { goToLogin('multiregression', 'csv'); return }
    if (!result) return;
    const header = `Index,${predictorNames.join(',')},Y,Fitted,Residual,StandardizedResidual\n`;
    const body = result.residuals
      .map((r, i) => {
        const xVals = dataRows![i].x.join(',');
        return [r.index + 1, xVals, r.y, r.fitted, r.residual, r.standardizedResidual].join(',');
      })
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'multiple-linear-regression.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export: Excel ────────────────────────────────────────────────────
  async function exportExcel() {
    if (!isPro) { goToPricing('multiregression', 'excel'); return }
    if (!result) return;

    const eqTerms = result.coefficients.map((c) => `${niceNum(c.coef)}·${c.term === 'Constant' ? '' : c.term}`).join(' + ');
    const report = createReport({ toolName: 'Multiple Linear Regression' });
    const overview = report.addSheet('Regression Summary');
    overview.titleBand('Multiple Linear Regression Report', `N = ${result.n}   |   Y = ${eqTerms}`);
    overview.metaStrip([
      ['Generated on', nowStamp()],
      ['Predictors', predictorNames.join(', ')],
      ['Response (Y)', yCol],
    ]);

    overview.sectionHeading('Coefficients');
    overview.table({
      headers: [
        { header: 'Term', key: 'term', align: 'left', width: 16 },
        { header: 'Coef', key: 'coef', align: 'right' },
        { header: 'SE Coef', key: 'se', align: 'right' },
        { header: 'T-Value', key: 't', align: 'right' },
        { header: 'P-Value', key: 'p', align: 'right' },
        { header: 'VIF', key: 'vif', align: 'right' },
      ],
      rows: result.coefficients.map((row) => [
        row.term, niceNum(row.coef), niceNum(row.se), niceNum(row.tStat), formatP(row.pValue),
        row.vif === null ? '' : niceNum(row.vif, 2),
      ]),
    });

    overview.sectionHeading('Analysis of Variance');
    overview.table({
      headers: [
        { header: 'Source', key: 'source', align: 'left', width: 18 },
        { header: 'DF', key: 'df', align: 'right' },
        { header: 'Seq SS', key: 'ss', align: 'right' },
        { header: 'Adj MS', key: 'ms', align: 'right' },
        { header: 'F-Value', key: 'f', align: 'right' },
        { header: 'P-Value', key: 'p', align: 'right' },
      ],
      rows: result.anova.map((row) => [
        row.source, row.df, niceNum(row.seqSS), Number.isNaN(row.adjMS) ? '' : niceNum(row.adjMS),
        row.fStat === null ? '' : niceNum(row.fStat), row.pValue === null ? '' : formatP(row.pValue),
      ]),
    });

    overview.sectionHeading('Model Summary');
    overview.table({
      headers: ['Metric', 'Value'],
      rows: [
        ['R²', niceNum(result.r2)],
        ['R² (adj)', niceNum(result.r2Adj)],
        ['S (Residual SE)', niceNum(result.se)],
        ['Durbin-Watson', niceNum(result.durbinWatson)],
        ['Anderson-Darling A*', niceNum(result.andersonDarling.statistic)],
      ],
    });

    const dataSheet = report.addSheet('Residuals');
    dataSheet.sectionHeading('Fitted Values & Residuals');
    dataSheet.table({
      headers: [
        { header: '#', key: 'i', align: 'right' },
        ...predictorNames.map((name) => ({ header: name, key: name, align: 'right' as const })),
        { header: 'Y', key: 'y', align: 'right' },
        { header: 'Fitted', key: 'fit', align: 'right' },
        { header: 'Residual', key: 'res', align: 'right' },
        { header: 'Std Residual', key: 'sres', align: 'right' },
      ],
      rows: result.residuals.map((r, i) => [
        r.index + 1, ...dataRows![i].x.map((v) => niceNum(v, 3)),
        niceNum(r.y, 3), niceNum(r.fitted, 3), niceNum(r.residual, 3), niceNum(r.standardizedResidual, 3),
      ]),
      zebra: true,
    });
    dataSheet.freezeHeader(2);

    await report.download('multiple-linear-regression.xlsx');
  }

  // ── Export: PNG ─────────────────────────────────────────────────────
  function exportPNG() {
    if (!isLoggedIn) { goToLogin('multiregression', 'png'); return }
    if (!result) return;
    const width = 700;
    const rowH = 22;
    const height = 140 + rowH * (result.residuals.length + 1) + 20;
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
    ctx.fillText(`R² = ${niceNum(result.r2)}   R²(adj) = ${niceNum(result.r2Adj)}   N = ${result.n}`, 16, 74);

    let y = 100;
    ctx.fillStyle = '#1e2d40';
    ctx.fillRect(16, y, width - 32, rowH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const headers = ['#', 'Y', 'Fitted', 'Residual'];
    const colX = [24, 100, 220, 340];
    headers.forEach((h, i) => ctx.fillText(h, colX[i], y + 16));
    y += rowH;

    ctx.font = '12px system-ui, sans-serif';
    result.residuals.forEach((r, i) => {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(16, y, width - 32, rowH);
      }
      ctx.fillStyle = '#e2e8f0';
      const cells = [String(r.index + 1), niceNum(r.y, 2), niceNum(r.fitted, 2), niceNum(r.residual, 2)];
      cells.forEach((v, ci) => ctx.fillText(v, colX[ci], y + 16));
      y += rowH;
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'multiple-linear-regression.png';
    a.click();
  }

  // ── Export: PDF ─────────────────────────────────────────────────────
  function exportPDF() {
    if (!isPro) { goToPricing('multiregression', 'pdf'); return }
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
    pdf.text(`R² = ${niceNum(result.r2)}   R²(adj) = ${niceNum(result.r2Adj)}   S = ${niceNum(result.se)}   N = ${result.n}`, margin, y);
    y += 24;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Coefficients', margin, y);
    y += 8;
    const coefColX = [margin, margin + 90, margin + 170, margin + 250, margin + 320, margin + 390];
    const rowHeight = 18;
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
    pdf.setFontSize(9);
    ['Term', 'Coef', 'SE Coef', 'T-Value', 'P-Value', 'VIF'].forEach((h, i) => pdf.text(h, coefColX[i] + 4, y + 13));
    y += rowHeight;
    pdf.setFont('helvetica', 'normal');
    result.coefficients.forEach((row) => {
      const cells = [row.term, niceNum(row.coef), niceNum(row.se), niceNum(row.tStat), formatP(row.pValue), row.vif === null ? '' : niceNum(row.vif, 2)];
      cells.forEach((v, i) => pdf.text(v, coefColX[i] + 4, y + 13));
      y += rowHeight;
    });
    y += 16;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Analysis of Variance', margin, y);
    y += 8;
    const anovaColX = [margin, margin + 110, margin + 160, margin + 230, margin + 300, margin + 370];
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
    pdf.setFontSize(9);
    ['Source', 'DF', 'Seq SS', 'Adj MS', 'F', 'P'].forEach((h, i) => pdf.text(h, anovaColX[i] + 4, y + 13));
    y += rowHeight;
    pdf.setFont('helvetica', 'normal');
    result.anova.forEach((row) => {
      const cells = [
        row.source, String(row.df), niceNum(row.seqSS),
        Number.isNaN(row.adjMS) ? '' : niceNum(row.adjMS),
        row.fStat === null ? '' : niceNum(row.fStat),
        row.pValue === null ? '' : formatP(row.pValue),
      ];
      cells.forEach((v, i) => pdf.text(v, anovaColX[i] + 4, y + 13));
      y += rowHeight;
    });
    y += 16;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Fitted Values & Residuals', margin, y);
    y += 8;
    const resColX = [margin, margin + 40, margin + 130, margin + 220, margin + 310];
    const drawResHeader = () => {
      pdf.setFillColor(230, 230, 230);
      pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      ['#', 'Y', 'Fitted', 'Residual', 'Std Resid'].forEach((h, i) => pdf.text(h, resColX[i] + 4, y + 13));
      y += rowHeight;
    };
    drawResHeader();
    pdf.setFont('helvetica', 'normal');
    result.residuals.forEach((r) => {
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
        drawResHeader();
      }
      const cells = [String(r.index + 1), niceNum(r.y, 3), niceNum(r.fitted, 3), niceNum(r.residual, 3), niceNum(r.standardizedResidual, 3)];
      cells.forEach((v, i) => pdf.text(v, resColX[i] + 4, y + 13));
      y += rowHeight;
    });

    pdf.save('multiple-linear-regression.pdf');
  }

  const dangerText: React.CSSProperties = { fontSize: 13, color: c.danger, marginTop: 8 };
  const equationStr = result
    ? result.coefficients
        .map((coef, i) => (i === 0 ? niceNum(coef.coef) : `${coef.coef >= 0 ? '+' : '−'} ${niceNum(Math.abs(coef.coef))}·${coef.term}`))
        .join(' ')
    : '';

  const hasHighVif = result?.coefficients.some((c) => c.vif !== null && c.vif > 5) ?? false;

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_multiregression" />

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
            <button style={{ ...s.addBtn, marginTop: 8 }} onClick={() => readColumns()}>
              {messages.readColumnsButton}
            </button>
          </div>

          {headers.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <label>
                <div style={s.label}>{messages.responseLabel}</div>
                <select value={yCol} onChange={(e) => setYCol(e.target.value)} style={s.select}>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>

              <div style={{ marginTop: 12 }}>
                <div style={s.label}>{messages.predictorsLabel}</div>
                <p style={{ fontSize: 11, color: c.muted, marginBottom: 8 }}>{messages.predictorsHint}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {headers.filter((h) => h !== yCol).map((h) => {
                    const active = xCols.includes(h);
                    return (
                      <button
                        key={h}
                        onClick={() => togglePredictor(h)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: `1px solid ${active ? c.accent : c.border}`,
                          background: active ? `${c.accent}18` : 'transparent',
                          color: active ? c.accent : c.muted,
                        }}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <button style={{ ...s.addBtn, marginTop: 14 }} onClick={runAnalysis}>
            {messages.runAnalysisButton}
          </button>
          {error && <p style={dangerText}>{error}</p>}
        </div>

        {/* ── Results ─────────────────────────────────────────────────── */}
        {result && (
          <>
            <div style={s.card}>
              <div style={s.sectionTitle}>{messages.resultsTitle}</div>
              <p style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 14, wordBreak: 'break-word' }}>
                {messages.equationLabel}: Y = {equationStr}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.r2)}</div><div style={s.statLabel}>{messages.metricR2}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.r2Adj)}</div><div style={s.statLabel}>{messages.metricR2Adj}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{niceNum(result.se)}</div><div style={s.statLabel}>{messages.metricSE}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{result.k}</div><div style={s.statLabel}>{messages.metricK}</div></div>
                <div style={s.statCard}><div style={s.statVal}>{result.n}</div><div style={s.statLabel}>{messages.metricN}</div></div>
              </div>

              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 8 }}>{messages.coefTableTitle}</h3>
              <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>{messages.coefTerm}</th>
                      <th style={s.th}>{messages.coefValue}</th>
                      <th style={s.th}>{messages.coefSE}</th>
                      <th style={s.th}>{messages.coefT}</th>
                      <th style={s.th}>{messages.coefP}</th>
                      <th style={s.th}>{messages.coefVIF}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.coefficients.map((row) => (
                      <tr key={row.term}>
                        <td style={s.td}>{row.term}</td>
                        <td style={s.td}>{niceNum(row.coef)}</td>
                        <td style={s.td}>{niceNum(row.se)}</td>
                        <td style={s.td}>{niceNum(row.tStat)}</td>
                        <td style={s.td}>{formatP(row.pValue)}</td>
                        <td style={{ ...s.td, color: row.vif !== null && row.vif > 5 ? c.danger : c.text, fontWeight: row.vif !== null && row.vif > 5 ? 700 : 400 }}>
                          {row.vif === null ? '—' : niceNum(row.vif, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasHighVif && <p style={{ fontSize: 12, color: c.amber, marginTop: 8 }}>⚠ {messages.vifWarning}</p>}

              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, margin: '18px 0 8px' }}>{messages.anovaTableTitle}</h3>
              <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>{messages.anovaSource}</th>
                      <th style={s.th}>{messages.anovaDf}</th>
                      <th style={s.th}>{messages.anovaSS}</th>
                      <th style={s.th}>{messages.anovaMS}</th>
                      <th style={s.th}>{messages.anovaF}</th>
                      <th style={s.th}>{messages.anovaP}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.anova.map((row) => (
                      <tr key={row.source}>
                        <td style={s.td}>
                          {row.source === 'Regression' ? messages.anovaSourceRegression
                            : row.source === 'Residual Error' ? messages.anovaSourceResidual
                              : messages.anovaSourceTotal}
                        </td>
                        <td style={s.td}>{row.df}</td>
                        <td style={s.td}>{niceNum(row.seqSS)}</td>
                        <td style={s.td}>{Number.isNaN(row.adjMS) ? '—' : niceNum(row.adjMS)}</td>
                        <td style={s.td}>{row.fStat === null ? '—' : niceNum(row.fStat)}</td>
                        <td style={s.td}>{row.pValue === null ? '—' : formatP(row.pValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Residual diagnostic plots ────────────────────────────── */}
            <div style={s.card}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 10 }}>{messages.residualPlotsTitle}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {(() => {
                  const fits = result.residuals.map((r) => r.fitted);
                  const resids = result.residuals.map((r) => r.residual);
                  const g = smallChartGeom(fits, resids);
                  const zeroY = g.yFor(0);
                  return (
                    <div style={s.chartWrap}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 6 }}>{messages.residPlotVsFits}</p>
                      <svg width="100%" viewBox={`0 0 ${SMALL_CHART_W} ${SMALL_CHART_H}`} role="img" aria-label={messages.residPlotVsFits}>
                        <line x1={SPAD.left} y1={zeroY} x2={SMALL_CHART_W - SPAD.right} y2={zeroY} stroke={c.border} strokeDasharray="4 3" />
                        <line x1={SPAD.left} y1={SPAD.top} x2={SPAD.left} y2={SMALL_CHART_H - SPAD.bottom} stroke={c.border} />
                        <line x1={SPAD.left} y1={SMALL_CHART_H - SPAD.bottom} x2={SMALL_CHART_W - SPAD.right} y2={SMALL_CHART_H - SPAD.bottom} stroke={c.border} />
                        {result.residuals.map((r) => (
                          <circle key={r.index} cx={g.xFor(r.fitted)} cy={g.yFor(r.residual)} r={3} fill={c.accent} fillOpacity={0.85} />
                        ))}
                      </svg>
                    </div>
                  );
                })()}

                {(() => {
                  const order = result.residuals.map((r) => r.index + 1);
                  const resids = result.residuals.map((r) => r.residual);
                  const g = smallChartGeom(order, resids);
                  const zeroY = g.yFor(0);
                  return (
                    <div style={s.chartWrap}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 6 }}>{messages.residPlotVsOrder}</p>
                      <svg width="100%" viewBox={`0 0 ${SMALL_CHART_W} ${SMALL_CHART_H}`} role="img" aria-label={messages.residPlotVsOrder}>
                        <line x1={SPAD.left} y1={zeroY} x2={SMALL_CHART_W - SPAD.right} y2={zeroY} stroke={c.border} strokeDasharray="4 3" />
                        <line x1={SPAD.left} y1={SPAD.top} x2={SPAD.left} y2={SMALL_CHART_H - SPAD.bottom} stroke={c.border} />
                        <line x1={SPAD.left} y1={SMALL_CHART_H - SPAD.bottom} x2={SMALL_CHART_W - SPAD.right} y2={SMALL_CHART_H - SPAD.bottom} stroke={c.border} />
                        <polyline
                          fill="none"
                          stroke={c.line}
                          strokeWidth={1}
                          opacity={0.5}
                          points={result.residuals.map((r) => `${g.xFor(r.index + 1)},${g.yFor(r.residual)}`).join(' ')}
                        />
                        {result.residuals.map((r) => (
                          <circle key={r.index} cx={g.xFor(r.index + 1)} cy={g.yFor(r.residual)} r={3} fill={c.accent} fillOpacity={0.85} />
                        ))}
                      </svg>
                    </div>
                  );
                })()}

                {(() => {
                  const resids = result.residuals.map((r) => r.residual);
                  const minR = Math.min(...resids);
                  const maxR = Math.max(...resids);
                  const binCount = Math.max(4, Math.min(9, Math.round(Math.sqrt(resids.length))));
                  const binWidth = (maxR - minR || 1) / binCount;
                  const bins = new Array(binCount).fill(0);
                  resids.forEach((r) => {
                    const idx = Math.min(binCount - 1, Math.floor((r - minR) / binWidth));
                    bins[Math.max(0, idx)] += 1;
                  });
                  const maxCount = Math.max(...bins, 1);
                  const barW = SPLOT_W / binCount;
                  return (
                    <div style={s.chartWrap}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 6 }}>{messages.residPlotHistogram}</p>
                      <svg width="100%" viewBox={`0 0 ${SMALL_CHART_W} ${SMALL_CHART_H}`} role="img" aria-label={messages.residPlotHistogram}>
                        <line x1={SPAD.left} y1={SPAD.top} x2={SPAD.left} y2={SMALL_CHART_H - SPAD.bottom} stroke={c.border} />
                        <line x1={SPAD.left} y1={SMALL_CHART_H - SPAD.bottom} x2={SMALL_CHART_W - SPAD.right} y2={SMALL_CHART_H - SPAD.bottom} stroke={c.border} />
                        {bins.map((count, i) => {
                          const h = (count / maxCount) * SPLOT_H;
                          const x = SPAD.left + i * barW;
                          const y = SMALL_CHART_H - SPAD.bottom - h;
                          return <rect key={i} x={x + 1} y={y} width={Math.max(barW - 2, 1)} height={h} fill={c.bar} />;
                        })}
                      </svg>
                    </div>
                  );
                })()}

                {(() => {
                  const sorted = [...result.residuals].sort((a, b) => a.standardizedResidual - b.standardizedResidual);
                  const n = sorted.length;
                  const points = sorted.map((r, i) => {
                    const pp = (i + 0.5) / n;
                    const z = Math.sqrt(2) * inverseErf(2 * pp - 1);
                    return { z, resid: r.standardizedResidual };
                  });
                  const zs = points.map((p) => p.z);
                  const rs = points.map((p) => p.resid);
                  const g = smallChartGeom(zs, rs);
                  return (
                    <div style={s.chartWrap}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 6 }}>{messages.residPlotNormal}</p>
                      <svg width="100%" viewBox={`0 0 ${SMALL_CHART_W} ${SMALL_CHART_H}`} role="img" aria-label={messages.residPlotNormal}>
                        <line x1={SPAD.left} y1={SPAD.top} x2={SPAD.left} y2={SMALL_CHART_H - SPAD.bottom} stroke={c.border} />
                        <line x1={SPAD.left} y1={SMALL_CHART_H - SPAD.bottom} x2={SMALL_CHART_W - SPAD.right} y2={SMALL_CHART_H - SPAD.bottom} stroke={c.border} />
                        {points.map((p, i) => (
                          <circle key={i} cx={g.xFor(p.z)} cy={g.yFor(p.resid)} r={3} fill={c.accent} fillOpacity={0.85} />
                        ))}
                      </svg>
                    </div>
                  );
                })()}
              </div>

              <p style={{ fontSize: 12, color: c.muted, marginTop: 14 }}>
                {messages.normalityNote(niceNum(result.andersonDarling.statistic, 3), result.andersonDarling.pValueApprox)}
              </p>
              <p style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>
                {messages.durbinWatsonNote(niceNum(result.durbinWatson, 3))}
              </p>
            </div>

            {/* ── Prediction ────────────────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.sectionTitle}>{messages.predictionTitle}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                {predictorNames.map((name) => (
                  <label key={name}>
                    <div style={s.label}>{name}</div>
                    <input
                      type="number"
                      value={predictInputs[name] ?? ''}
                      onChange={(e) => setPredictInputs((prev) => ({ ...prev, [name]: e.target.value }))}
                      style={s.input}
                    />
                  </label>
                ))}
              </div>

              {prediction && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 14 }}>
                  <div style={s.statCard}>
                    <div style={s.statVal}>{niceNum(prediction.fitted)}</div>
                    <div style={s.statLabel}>{messages.predictionFitted}</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={{ ...s.statVal, fontSize: 15 }}>{niceNum(prediction.ciLow)} – {niceNum(prediction.ciHigh)}</div>
                    <div style={s.statLabel}>{messages.predictionCI}</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={{ ...s.statVal, fontSize: 15 }}>{niceNum(prediction.piLow)} – {niceNum(prediction.piHigh)}</div>
                    <div style={s.statLabel}>{messages.predictionPI}</div>
                  </div>
                </div>
              )}
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
                  tool="multiregression"
                  defaultName={`Multiple Linear Regression — ${new Date().toLocaleDateString('en-US')}`}
                  getPayload={() =>
                    !dataRows || !result
                      ? null
                      : { input_data: { rows: dataRows, predictorNames, yCol }, results: result }
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
