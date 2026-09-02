'use client';

import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import {
  runFullFactorial,
  buildDesignMatrix,
  randomizeRunOrder,
  validateFactors,
  MIN_FACTORS,
  MAX_FACTORS,
  type FactorDef,
  type DesignRow,
  type DoeResult,
} from '@/lib/doe/calculator';
import { messages as messagesEn } from '@/lib/doe/messages';
import { messagesAr } from '@/lib/doe/messages.ar';
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme';
import Nav from '@/components/Nav';
import SaveAnalysisButton from '@/components/SaveAnalysisButton';
import { useSubscription } from '@/lib/useSubscription';
import { goToLogin, goToPricing } from '@/lib/exportGate';
import { useLanguage } from '@/lib/i18n/context';
import { createReport, nowStamp } from '@/lib/excelReport';

const CHART_W = 640;
const CHART_H = 260;

const EXAMPLE_FACTORS: FactorDef[] = [
  { name: 'A', low: 150, high: 200 }, // Temperature
  { name: 'B', low: 30, high: 50 }, // Pressure
  { name: 'C', low: 10, high: 20 }, // Concentration
];

// Montgomery 2^3 filtration-style example, 2 replicates per run (values
// chosen so effects/ANOVA come out non-trivial and easy to sanity check).
const EXAMPLE_RESPONSES: number[][] = [
  [45, 48], // (-,-,-)
  [71, 68], // (+,-,-)
  [48, 50], // (-,+,-)
  [65, 62], // (+,+,-)
  [68, 71], // (-,-,+)
  [60, 58], // (+,-,+)
  [80, 77], // (-,+,+)
  [65, 63], // (+,+,+)
];

function niceNum(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 100000 || (Math.abs(n) < 0.0001 && n !== 0)) return n.toExponential(3);
  return n.toFixed(digits);
}

type Step = 'setup' | 'data' | 'results';

export default function DoePage() {
  const [theme, setTheme] = usePersistedTheme();
  const { lang } = useLanguage();
  const messages = lang === 'ar' ? messagesAr : messagesEn;
  const c = COLORS[theme];
  const s = getSharedStyles(theme);
  const { isPro, isLoggedIn } = useSubscription();

  const [step, setStep] = useState<Step>('setup');
  const [numFactors, setNumFactors] = useState(3);
  const [factors, setFactors] = useState<FactorDef[]>([
    { name: 'A', low: 0, high: 1 },
    { name: 'B', low: 0, high: 1 },
    { name: 'C', low: 0, high: 1 },
  ]);
  const [replicates, setReplicates] = useState(1);
  const [randomize, setRandomize] = useState(false);
  const [error, setError] = useState('');

  const [designRows, setDesignRows] = useState<DesignRow[] | null>(null);
  const [responseMap, setResponseMap] = useState<Record<string, string>>({}); // key: `${standardOrder}-${replicate}`
  const [result, setResult] = useState<DoeResult | null>(null);

  function updateFactorCount(n: number) {
    setNumFactors(n);
    setFactors((prev) => {
      const next = [...prev];
      while (next.length < n) {
        const letter = String.fromCharCode(65 + next.length);
        next.push({ name: letter, low: 0, high: 1 });
      }
      return next.slice(0, n);
    });
  }

  function updateFactor(idx: number, patch: Partial<FactorDef>) {
    setFactors((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function loadExample() {
    setNumFactors(3);
    setFactors(EXAMPLE_FACTORS);
    setReplicates(2);
    setRandomize(false);
    setError('');
    const rows = buildDesignMatrix(EXAMPLE_FACTORS, 2);
    setDesignRows(rows);
    const map: Record<string, string> = {};
    rows.forEach((row) => {
      const pointIdx = row.standardOrder - 1;
      map[`${row.standardOrder}-${row.replicate}`] = String(EXAMPLE_RESPONSES[pointIdx][row.replicate - 1]);
    });
    setResponseMap(map);
    setResult(null);
    setStep('data');
  }

  function clearAll() {
    setDesignRows(null);
    setResponseMap({});
    setResult(null);
    setError('');
    setStep('setup');
  }

  function generateDesign() {
    const err = validateFactors(factors);
    if (err === 'too-few-factors') { setError(messages.errorTooFewFactors); return; }
    if (err === 'too-many-factors') { setError(messages.errorTooManyFactors); return; }
    if (err === 'invalid-levels') { setError(messages.errorInvalidLevels); return; }
    setError('');
    let rows = buildDesignMatrix(factors, Math.max(1, replicates));
    if (randomize) rows = randomizeRunOrder(rows);
    setDesignRows(rows);
    setResponseMap({});
    setResult(null);
    setStep('data');
  }

  function setResponse(standardOrder: number, replicate: number, value: string) {
    setResponseMap((prev) => ({ ...prev, [`${standardOrder}-${replicate}`]: value }));
  }

  function runAnalysis() {
    if (!designRows) return;
    const runsPerRep = Math.pow(2, factors.length);
    const responses: number[][] = Array.from({ length: runsPerRep }, () => []);
    let hasMissing = false;
    for (let point = 1; point <= runsPerRep; point++) {
      for (let rep = 1; rep <= replicates; rep++) {
        const raw = responseMap[`${point}-${rep}`];
        const num = Number(raw);
        if (raw === undefined || raw === '' || !Number.isFinite(num)) {
          hasMissing = true;
          continue;
        }
        responses[point - 1].push(num);
      }
    }
    if (hasMissing || responses.some((r) => r.length === 0)) {
      setError(messages.errorMissingResponses);
      return;
    }
    setError('');
    const res = runFullFactorial(factors, responses);
    setResult(res);
    setStep('results');
  }

  // ── Effects Pareto geometry ──────────────────────────────────────────
  const paretoGeom = useMemo(() => {
    if (!result) return null;
    const bars = result.effects.map((e) => ({ term: e.term, abs: Math.abs(e.effect) }));
    const maxAbs = Math.max(...bars.map((b) => b.abs), 1e-9);
    return { bars, maxAbs };
  }, [result]);

  // ── Export: CSV ──────────────────────────────────────────────────────
  function exportCSV() {
    if (!isLoggedIn) { goToLogin('doe', 'csv'); return }
    if (!result || !designRows) return;
    const header = `RunOrder,StdOrder,Replicate,${factors.map((f) => f.name).join(',')},Response\n`;
    const body = designRows
      .map((row) => {
        const point = row.standardOrder;
        const resp = responseMap[`${point}-${row.replicate}`] ?? '';
        const factorVals = factors.map((f) => row.actual[f.name]).join(',');
        return [row.runOrder, row.standardOrder, row.replicate, factorVals, resp].join(',');
      })
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'doe-full-factorial.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export: Excel ────────────────────────────────────────────────────
  async function exportExcel() {
    if (!isPro) { goToPricing('doe', 'excel'); return }
    if (!result || !designRows) return;

    const report = createReport({ toolName: 'Design of Experiments' });
    const overview = report.addSheet('DOE Summary');
    overview.titleBand(
      'Full Factorial Design of Experiments Report',
      `Factors = ${result.k}   |   Runs = ${result.totalRuns}   |   R² = ${niceNum(result.r2 * 100, 1)}%`
    );
    overview.metaStrip([['Generated on', nowStamp()]]);

    overview.sectionHeading('Effects & Contribution');
    overview.table({
      headers: ['Term', 'Effect', 'Contrast', 'SS', '% Contribution'],
      rows: result.effects.map((e) => [
        e.term,
        niceNum(e.effect, 3),
        niceNum(e.contrast, 3),
        niceNum(e.ss, 3),
        niceNum((e.ss / result.sst) * 100, 1),
      ]),
    });

    overview.sectionHeading('Analysis of Variance');
    overview.table({
      headers: ['Source', 'DF', 'SS', 'MS', 'F-Value', 'P-Value'],
      rows: result.anova.map((a) => [
        a.source,
        a.df,
        niceNum(a.ss, 3),
        Number.isFinite(a.ms) ? niceNum(a.ms, 3) : '—',
        a.fStat !== null ? niceNum(a.fStat, 3) : '—',
        a.pValue !== null ? niceNum(a.pValue, 4) : '—',
      ]),
    });

    const dataSheet = report.addSheet('Design Matrix');
    dataSheet.sectionHeading('Runs & Responses');
    dataSheet.table({
      headers: [
        { header: 'Run Order', key: 'run', align: 'right' },
        { header: 'Std Order', key: 'std', align: 'right' },
        { header: 'Rep', key: 'rep', align: 'right' },
        ...factors.map((f) => ({ header: f.name, key: f.name, align: 'right' as const })),
        { header: 'Response', key: 'resp', align: 'right' },
      ],
      rows: designRows.map((row) => [
        row.runOrder,
        row.standardOrder,
        row.replicate,
        ...factors.map((f) => niceNum(row.actual[f.name], 3)),
        responseMap[`${row.standardOrder}-${row.replicate}`] ?? '',
      ]),
      zebra: true,
    });
    dataSheet.freezeHeader(2);

    await report.download('doe-full-factorial.xlsx');
  }

  // ── Export: PNG (results snapshot as a table image) ──────────────────
  function exportPNG() {
    if (!isLoggedIn) { goToLogin('doe', 'png'); return }
    if (!result) return;
    const width = 700;
    const rowH = 22;
    const height = 140 + rowH * (result.effects.length + 1) + 20;
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
    ctx.fillText(`Factors = ${result.k}   Runs = ${result.totalRuns}   R² = ${niceNum(result.r2 * 100, 1)}%`, 16, 74);

    let y = 100;
    ctx.fillStyle = '#1e2d40';
    ctx.fillRect(16, y, width - 32, rowH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const headers = ['Term', 'Effect', 'SS', '% Contrib'];
    const colX = [24, 180, 340, 480];
    headers.forEach((h, i) => ctx.fillText(h, colX[i], y + 16));
    y += rowH;

    ctx.font = '12px system-ui, sans-serif';
    result.effects.forEach((e, i) => {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(16, y, width - 32, rowH);
      }
      ctx.fillStyle = '#e2e8f0';
      const cells = [e.term, niceNum(e.effect, 3), niceNum(e.ss, 3), `${niceNum((e.ss / result.sst) * 100, 1)}%`];
      cells.forEach((val, ci) => ctx.fillText(val, colX[ci], y + 16));
      y += rowH;
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'doe-full-factorial.png';
    a.click();
  }

  // ── Export: PDF ─────────────────────────────────────────────────────
  function exportPDF() {
    if (!isPro) { goToPricing('doe', 'pdf'); return }
    if (!result || !designRows) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;
    const rowHeight = 18;

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
    pdf.text(`Factors = ${result.k}   Runs = ${result.totalRuns}   R² = ${niceNum(result.r2 * 100, 1)}%`, margin, y);
    y += 24;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Effects & Contribution', margin, y);
    y += 8;
    const effColX = [margin, margin + 90, margin + 200, margin + 300, margin + 400];
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    ['Term', 'Effect', 'Contrast', 'SS', '% Contrib'].forEach((h, i) => pdf.text(h, effColX[i] + 4, y + 13));
    y += rowHeight;
    pdf.setFont('helvetica', 'normal');
    result.effects.forEach((e) => {
      if (y + rowHeight > pageHeight - margin) { pdf.addPage(); y = margin; }
      const cells = [e.term, niceNum(e.effect, 3), niceNum(e.contrast, 3), niceNum(e.ss, 3), `${niceNum((e.ss / result.sst) * 100, 1)}%`];
      cells.forEach((val, i) => pdf.text(val, effColX[i] + 4, y + 13));
      y += rowHeight;
    });
    y += 16;

    if (y + rowHeight * 3 > pageHeight - margin) { pdf.addPage(); y = margin; }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Analysis of Variance', margin, y);
    y += 8;
    const anovaColX = [margin, margin + 100, margin + 160, margin + 240, margin + 320, margin + 400];
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    ['Source', 'DF', 'SS', 'MS', 'F', 'P'].forEach((h, i) => pdf.text(h, anovaColX[i] + 4, y + 13));
    y += rowHeight;
    pdf.setFont('helvetica', 'normal');
    result.anova.forEach((a) => {
      if (y + rowHeight > pageHeight - margin) { pdf.addPage(); y = margin; }
      const cells = [
        a.source,
        String(a.df),
        niceNum(a.ss, 3),
        Number.isFinite(a.ms) ? niceNum(a.ms, 3) : '—',
        a.fStat !== null ? niceNum(a.fStat, 3) : '—',
        a.pValue !== null ? niceNum(a.pValue, 4) : '—',
      ];
      cells.forEach((val, i) => pdf.text(val, anovaColX[i] + 4, y + 13));
      y += rowHeight;
    });

    pdf.save('doe-full-factorial.pdf');
  }

  const dangerText: React.CSSProperties = { fontSize: 13, color: c.danger, marginTop: 8 };

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_doe" />

      <div style={s.body}>
        <div style={s.left}>
          <div>
            <div style={s.sectionTitle}>{messages.setupSectionTitle}</div>
            <p style={{ fontSize: 12, color: c.muted, marginBottom: 14 }}>{messages.setupSectionHelp}</p>

            <div style={{ marginBottom: 12 }}>
              <div style={s.label}>{messages.numFactorsLabel}</div>
              <select
                style={s.select}
                value={numFactors}
                onChange={(e) => updateFactorCount(Number(e.target.value))}
              >
                {Array.from({ length: MAX_FACTORS - MIN_FACTORS + 1 }, (_, i) => MIN_FACTORS + i).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {factors.map((f, idx) => (
              <div key={idx} style={s.rowCard}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                  <div>
                    <div style={s.label}>{messages.factorNameLabel}</div>
                    <input
                      style={s.input}
                      value={f.name}
                      onChange={(e) => updateFactor(idx, { name: e.target.value || String.fromCharCode(65 + idx) })}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <div style={s.label}>{messages.factorLowLabel}</div>
                      <input
                        style={s.input}
                        type="number"
                        value={f.low}
                        onChange={(e) => updateFactor(idx, { low: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <div style={s.label}>{messages.factorHighLabel}</div>
                      <input
                        style={s.input}
                        type="number"
                        value={f.high}
                        onChange={(e) => updateFactor(idx, { high: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 8, marginBottom: 12 }}>
              <div style={s.label}>{messages.replicatesLabel}</div>
              <input
                style={s.input}
                type="number"
                min={1}
                value={replicates}
                onChange={(e) => setReplicates(Math.max(1, Number(e.target.value) || 1))}
              />
              <p style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>{messages.replicatesHint}</p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={randomize} onChange={(e) => setRandomize(e.target.checked)} />
              {messages.randomizeLabel}
            </label>

            {error && <p style={dangerText}>{error}</p>}

            <button style={{ ...s.ctaBtn, width: '100%', textAlign: 'center', border: 'none', cursor: 'pointer' }} onClick={generateDesign}>
              {messages.generateDesignButton}
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button style={{ ...s.exportBtn, flex: 1 }} onClick={loadExample}>{messages.loadExampleButton}</button>
              <button style={{ ...s.exportBtn, flex: 1 }} onClick={clearAll}>{messages.clearButton}</button>
            </div>
          </div>
        </div>

        <div style={s.main}>
          {step === 'data' && designRows && (
            <div style={s.card}>
              <div style={s.sectionTitle}>{messages.designSectionTitle}</div>
              <p style={{ fontSize: 12, color: c.muted, marginBottom: 14 }}>{messages.designSectionHelp}</p>

              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>{messages.colRunOrder}</th>
                      <th style={s.th}>{messages.colStdOrder}</th>
                      {replicates > 1 && <th style={s.th}>{messages.colReplicate}</th>}
                      {factors.map((f) => (
                        <th key={f.name} style={s.th}>{f.name}</th>
                      ))}
                      <th style={s.th}>{messages.colResponse}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {designRows.map((row, i) => (
                      <tr key={i}>
                        <td style={s.td}>{row.runOrder}</td>
                        <td style={s.td}>{row.standardOrder}</td>
                        {replicates > 1 && <td style={s.td}>{row.replicate}</td>}
                        {factors.map((f) => (
                          <td key={f.name} style={s.td}>{niceNum(row.actual[f.name], 3)}</td>
                        ))}
                        <td style={s.td}>
                          <input
                            style={{ ...s.input, width: 100 }}
                            placeholder={messages.responsePlaceholder}
                            value={responseMap[`${row.standardOrder}-${row.replicate}`] ?? ''}
                            onChange={(e) => setResponse(row.standardOrder, row.replicate, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && <p style={dangerText}>{error}</p>}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={s.exportBtn} onClick={() => setStep('setup')}>{messages.backToSetupButton}</button>
                <button style={{ ...s.ctaBtn, border: 'none', cursor: 'pointer' }} onClick={runAnalysis}>
                  {messages.runAnalysisButton}
                </button>
              </div>
            </div>
          )}

          {step === 'results' && result && (
            <>
              <div style={s.card}>
                <div style={s.sectionTitle}>{messages.resultsTitle}</div>
                <div style={s.statsRow}>
                  <div style={s.statCard}>
                    <div style={s.statVal}>{niceNum(result.r2 * 100, 1)}%</div>
                    <div style={s.statLabel}>{messages.metricR2}</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statVal}>{niceNum(result.r2Adj * 100, 1)}%</div>
                    <div style={s.statLabel}>{messages.metricR2Adj}</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statVal}>{result.totalRuns}</div>
                    <div style={s.statLabel}>{messages.metricRuns}</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statVal}>{result.k}</div>
                    <div style={s.statLabel}>{messages.metricFactors}</div>
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <div style={s.sectionTitle}>{messages.effectsTableTitle}</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>{messages.effectsTerm}</th>
                        <th style={s.th}>{messages.effectsEffect}</th>
                        <th style={s.th}>{messages.effectsContrast}</th>
                        <th style={s.th}>{messages.effectsSS}</th>
                        <th style={s.th}>{messages.effectsPercentContribution}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.effects.map((e) => (
                        <tr key={e.term}>
                          <td style={s.td}>{e.term}</td>
                          <td style={s.td}>{niceNum(e.effect, 3)}</td>
                          <td style={s.td}>{niceNum(e.contrast, 3)}</td>
                          <td style={s.td}>{niceNum(e.ss, 3)}</td>
                          <td style={s.td}>{niceNum((e.ss / result.sst) * 100, 1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {paretoGeom && (
                <div style={s.chartWrap}>
                  <div style={s.sectionTitle}>{messages.paretoTitle}</div>
                  <svg width="100%" viewBox={`0 0 ${CHART_W} ${Math.max(CHART_H, paretoGeom.bars.length * 32 + 40)}`}>
                    {paretoGeom.bars.map((b, i) => {
                      const barMaxW = CHART_W - 160;
                      const w = (b.abs / paretoGeom.maxAbs) * barMaxW;
                      const yPos = 20 + i * 32;
                      return (
                        <g key={b.term}>
                          <text x={8} y={yPos + 15} fontSize={12} fill={c.text}>{b.term}</text>
                          <rect x={100} y={yPos} width={Math.max(w, 1)} height={20} fill={c.bar} rx={3} />
                          <text x={100 + w + 8} y={yPos + 15} fontSize={11} fill={c.muted}>{niceNum(b.abs, 3)}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              <div style={s.card}>
                <div style={s.sectionTitle}>{messages.anovaTableTitle}</div>
                {result.dfError === 0 && <p style={{ fontSize: 12, color: c.amber, marginBottom: 10 }}>{messages.noReplicationNote}</p>}
                <div style={{ overflowX: 'auto' }}>
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
                      {result.anova.map((a, i) => {
                        const isSig = a.pValue !== null && a.pValue < 0.05;
                        return (
                          <tr key={i}>
                            <td style={s.td}>{a.source}</td>
                            <td style={s.td}>{a.df}</td>
                            <td style={s.td}>{niceNum(a.ss, 3)}</td>
                            <td style={s.td}>{Number.isFinite(a.ms) ? niceNum(a.ms, 3) : '—'}</td>
                            <td style={s.td}>{a.fStat !== null ? niceNum(a.fStat, 3) : '—'}</td>
                            <td style={s.td}>
                              {a.pValue !== null ? (
                                <span style={{
                                  ...s.badge,
                                  background: isSig ? `${c.accent}22` : `${c.muted}22`,
                                  color: isSig ? c.accent : c.muted,
                                }}>
                                  {niceNum(a.pValue, 4)} · {isSig ? messages.significantBadge : messages.notSignificantBadge}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={s.card}>
                <div style={s.sectionTitle}>{messages.equationTitle}</div>
                <p style={{ fontSize: 12, color: c.muted, marginBottom: 10 }}>{messages.equationNote}</p>
                <p style={{ fontSize: 13, fontFamily: 'monospace', color: c.text, lineHeight: 1.8 }}>
                  Ŷ = {niceNum(result.regressionCoded[0].coefficient, 3)}
                  {result.regressionCoded.slice(1).map((r) => (
                    <span key={r.term}> {r.coefficient >= 0 ? '+' : '−'} {niceNum(Math.abs(r.coefficient), 3)}·{r.term}</span>
                  ))}
                </p>
              </div>

              <div style={s.card}>
                <div style={s.sectionTitle}>{messages.exportSectionTitle}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                  <SaveAnalysisButton
                    theme={theme}
                    tool="doe"
                    defaultName="DOE Full Factorial"
                    getPayload={() => {
                      if (!result || !designRows) return null;
                      return {
                        input_data: { factors, replicates, responseMap },
                        results: result,
                      };
                    }}
                  />
                </div>
                <p style={{ fontSize: 11, color: c.muted, marginTop: 12 }}>{messages.footerNote}</p>
              </div>
            </>
          )}

          {step === 'setup' && (
            <div style={s.card}>
              <div style={s.sectionTitle}>{messages.requiredDataTitle}</div>
              <p style={{ fontSize: 13, color: c.muted }}>{messages.requiredDataBody}</p>
              <p style={{ fontSize: 13, color: c.text, marginTop: 12 }}>{messages.appSubtitle}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
