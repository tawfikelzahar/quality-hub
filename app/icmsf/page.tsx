'use client';

import { useMemo, useState } from 'react';
import {
  CONDITION_EFFECT_ORDER,
  TEST_TYPE_ORDER,
  getHazardLevelsForTestType,
  type HazardLevel,
  type ConditionEffect,
  type TestType,
} from '@/lib/icmsf/tables';
import {
  resolveCase,
  resolvePlan,
  generateOcCurve,
  probabilityOfAcceptance,
  type Limits,
} from '@/lib/icmsf/calculator';
import { messages as messagesEn, type IcmsfMessages } from '@/lib/icmsf/messages';
import { messagesAr } from '@/lib/icmsf/messages.ar';
import { COLORS, getSharedStyles, usePersistedTheme } from '@/lib/theme';
import Nav from '@/components/Nav';
import SaveAnalysisButton from '@/components/SaveAnalysisButton';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useSubscription } from '@/lib/useSubscription';
import { goToLogin, goToPricing } from '@/lib/exportGate';
import { useLanguage } from '@/lib/i18n/context';
import { createReport as createExcelReport, nowStamp } from '@/lib/excelReport';
import {
  createReport as createPdfReport,
  classificationBanner,
  twoColumnTables,
  calloutBox,
  interpretationBox,
  finalizeReport,
  sectionHeading,
  sanitizePdfText,
  REPORT_COLORS,
  type KVRow,
  type ReportContext,
} from '@/lib/pdf/reportDesign';

// ─────────────────────────────────────────────────────────────────────────
// Chart geometry — plain inline SVG (no charting library dependency),
// matching the project's existing "draw it directly" approach used for
// the AQL tool's PNG/PDF exports.
// ─────────────────────────────────────────────────────────────────────────
const CHART_W = 640;
const CHART_H = 300;
const PAD = { top: 16, right: 20, bottom: 40, left: 48 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

// Short label for PDF/Excel table cells — messagesEn.testTypes[] is the full
// explanatory paragraph meant for the Step 0 selector UI; dropping that
// whole paragraph into a report table row pushed rows tall enough to force
// an unnecessary second page (confirmed by rendering both variants
// headlessly and comparing page counts). Exports stay English regardless
// of UI language, same as the rest of messagesEn usage in this file.
const TEST_TYPE_REPORT_LABEL: Record<TestType, string> = {
  qualitative: 'Qualitative — Presence/Absence',
  quantitative: 'Quantitative — Enumeration',
};

function xForP(p: number) {
  return PAD.left + p * PLOT_W;
}
function yForPa(pa: number) {
  return PAD.top + (1 - pa) * PLOT_H;
}

export default function IcmsfPage() {
  const [theme, setTheme] = usePersistedTheme();
  const { lang } = useLanguage();
  const messages: IcmsfMessages = lang === 'ar' ? messagesAr : messagesEn;
  const c = COLORS[theme];
  const s = getSharedStyles(theme);
  const { isPro, isLoggedIn } = useSubscription();

  const [testType, setTestType] = useState<TestType | ''>('');
  const [hazardLevel, setHazardLevel] = useState<HazardLevel | ''>('');
  const [conditionEffect, setConditionEffect] = useState<ConditionEffect | ''>('');
  const [limits, setLimits] = useState<Limits>({ m: null, M: null });
  const [riskCheckP, setRiskCheckP] = useState<number>(10);

  const availableHazardLevels = useMemo(
    () => (testType ? getHazardLevelsForTestType(testType) : []),
    [testType],
  );

  function handleTestTypeChange(next: TestType) {
    setTestType(next);
    // Reset everything downstream — a hazard level valid for the previous
    // test type may not exist for the new one.
    setHazardLevel('');
    setConditionEffect('');
    setLimits({ m: null, M: null });
  }

  const resolvedCase = useMemo(() => {
    if (!hazardLevel || !conditionEffect) return null;
    return resolveCase(hazardLevel, conditionEffect);
  }, [hazardLevel, conditionEffect]);

  const plan = useMemo(() => {
    if (!resolvedCase) return null;
    return resolvePlan(resolvedCase.case, limits);
  }, [resolvedCase, limits]);

  const ocCurve = useMemo(() => {
    if (!plan || !plan.ocCurveAvailable) return null;
    return generateOcCurve(plan.icmsfCase.n, plan.icmsfCase.c, 0.01);
  }, [plan]);

  const riskCheckPa = useMemo(() => {
    if (!plan || !plan.ocCurveAvailable) return null;
    return probabilityOfAcceptance(plan.icmsfCase.n, plan.icmsfCase.c, riskCheckP / 100);
  }, [plan, riskCheckP]);

  const linePath = useMemo(() => {
    if (!ocCurve) return '';
    return ocCurve
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xForP(pt.p).toFixed(1)} ${yForPa(pt.pa).toFixed(1)}`)
      .join(' ');
  }, [ocCurve]);

  function csvRow(): string {
    if (!plan) return '';
    const { icmsfCase } = plan;
    const header = 'Case,Plan Class,n,c,m,M\n';
    const row = [
      icmsfCase.case,
      icmsfCase.planClass,
      icmsfCase.n,
      icmsfCase.c,
      limits.m ?? '',
      limits.M ?? '',
    ].join(',');
    return header + row;
  }

  function exportCSV() {
    if (!isLoggedIn) { goToLogin('icmsf', 'csv'); return; }
    if (!plan) return;
    const blob = new Blob([csvRow()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'icmsf-sampling-plan.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPNG() {
    if (!isLoggedIn) { goToLogin('icmsf', 'png'); return; }
    if (!plan) return;
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(messages.pdfReportTitle, 16, 34);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(
      `Case ${plan.icmsfCase.case} — ${plan.icmsfCase.planClass}-class — n=${plan.icmsfCase.n}, c=${plan.icmsfCase.c}`,
      16,
      64,
    );
    if (limits.m !== null) ctx.fillText(`m = ${limits.m}`, 16, 90);
    if (limits.M !== null) ctx.fillText(`M = ${limits.M}`, 16, 114);
    const a = document.createElement('a');
    a.download = 'icmsf-sampling-plan.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  /** Vector OC curve drawn directly with jsPDF primitives (not a bitmap) —
   * ICMSF's on-screen OC curve is a hand-drawn inline SVG, not a Chart.js
   * canvas, so it doesn't fit the shared addChartImage() helper which
   * expects something with .toBase64Image(). */
  function drawOcCurvePdf(
    ctx: ReportContext,
    points: { p: number; pa: number }[],
    riskP: number,
    riskPa: number | null,
  ) {
    const { pdf, margin, pageWidth } = ctx;
    const chartH = 190;
    sectionHeading(ctx, 'Operating Characteristic (OC) Curve', chartH + 34);

    const plotLeft = margin + 34;
    const plotRight = pageWidth - margin;
    const plotTop = ctx.y;
    const plotBottom = ctx.y + chartH;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;
    const xForP = (p: number) => plotLeft + p * plotW;
    const yForPa = (pa: number) => plotBottom - pa * plotH;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    [0, 0.25, 0.5, 0.75, 1].forEach((frac) => {
      const y = yForPa(frac);
      pdf.setDrawColor(...REPORT_COLORS.border);
      pdf.setLineWidth(0.5);
      pdf.line(plotLeft, y, plotRight, y);
      pdf.setTextColor(...REPORT_COLORS.muted);
      pdf.text(`${Math.round(frac * 100)}%`, plotLeft - 6, y + 2, { align: 'right' });
      pdf.text(`${Math.round(frac * 100)}%`, xForP(frac), plotBottom + 10, { align: 'center' });
    });

    pdf.setDrawColor(...REPORT_COLORS.brand);
    pdf.setLineWidth(1.4);
    for (let i = 1; i < points.length; i++) {
      pdf.line(xForP(points[i - 1].p), yForPa(points[i - 1].pa), xForP(points[i].p), yForPa(points[i].pa));
    }

    if (riskPa !== null) {
      pdf.setFillColor(...REPORT_COLORS.warn);
      pdf.setDrawColor(...REPORT_COLORS.white);
      pdf.setLineWidth(0.8);
      pdf.circle(xForP(riskP / 100), yForPa(riskPa), 2.4, 'FD');
    }

    pdf.setTextColor(...REPORT_COLORS.muted);
    pdf.setFontSize(8);
    pdf.text(
      sanitizePdfText('True proportion defective in the lot (%)'),
      plotLeft + plotW / 2,
      plotBottom + 22,
      { align: 'center' },
    );
    pdf.text(sanitizePdfText('Probability of acceptance (%)'), margin, plotTop - 6);

    ctx.y = plotBottom + 30;
  }

  async function exportExcel() {
    if (!isPro) { goToPricing('icmsf', 'excel'); return; }
    if (!plan || !resolvedCase || !hazardLevel || !conditionEffect || !testType) return;

    const report = createExcelReport({ toolName: 'ICMSF Microbiological Sampling Plan' });
    const sheet = report.addSheet('Sampling Plan');
    sheet.titleBand('ICMSF Microbiological Sampling Plan', messagesEn.appSubtitle);
    sheet.metaStrip([
      ['Generated on', nowStamp()],
      ['Test Method Type', TEST_TYPE_REPORT_LABEL[testType]],
      ['ICMSF Case', messagesEn.resolvedCaseLabel(resolvedCase.case)],
    ]);

    sheet.sectionHeading('Case Selection');
    sheet.table({
      headers: ['Field', 'Value'],
      rows: [
        ['Test Method Type', TEST_TYPE_REPORT_LABEL[testType]],
        ['Degree of Health Hazard', messagesEn.hazardLevels[hazardLevel]],
        ['Conditions after Sampling', messagesEn.conditionEffects[conditionEffect]],
      ],
      zebra: false,
    });

    sheet.sectionHeading('Sampling Plan');
    sheet.kpiRow([
      { label: 'Case', value: resolvedCase.case, tone: 'accent' },
      { label: 'Plan Class', value: `${resolvedCase.planClass}-class`, tone: 'accent' },
      { label: 'n', value: resolvedCase.n, tone: 'neutral' },
      { label: 'c', value: resolvedCase.c, tone: 'neutral' },
    ]);
    sheet.table({
      headers: ['Case', 'Plan Class', 'n', 'c', 'm', 'M'],
      rows: [[
        resolvedCase.case,
        `${resolvedCase.planClass}-class`,
        resolvedCase.n,
        resolvedCase.c,
        limits.m ?? '—',
        resolvedCase.planClass === 3 ? (limits.M ?? '—') : 'N/A (2-class plan)',
      ]],
    });
    sheet.note(
      resolvedCase.planClass === 2
        ? messagesEn.planSummary(resolvedCase.n, resolvedCase.c)
        : messagesEn.threeClassSummary(resolvedCase.n, resolvedCase.c),
      'accent',
    );

    if (plan.ocCurveAvailable && ocCurve) {
      sheet.sectionHeading('Operating Characteristic (OC) Curve');
      sheet.table({
        headers: ['True % Defective', 'Probability of Acceptance (%)'],
        rows: ocCurve
          .filter((_, i) => i % 5 === 0)
          .map((pt) => [`${Math.round(pt.p * 100)}%`, Math.round(pt.pa * 1000) / 10]),
      });
      if (riskCheckPa !== null) {
        sheet.note(
          `At ${riskCheckP}% actual defective, this plan accepts the lot ${Math.round(riskCheckPa * 1000) / 10}% of the time.`,
          'warning',
        );
      }
    } else {
      sheet.note(messagesEn.ocCurveUnavailable3Class, 'neutral');
    }

    sheet.sectionHeading('Methodology');
    sheet.note(messagesEn.methodologyNote, 'neutral');
    sheet.freezeHeader(2);

    await report.download('icmsf-sampling-plan.xlsx');
  }

  function exportPDF() {
    if (!isPro) { goToPricing('icmsf', 'pdf'); return; }
    if (!plan || !resolvedCase || !hazardLevel || !conditionEffect || !testType) return;

    const ctx = createPdfReport('ICMSF Microbiological Sampling Plan Report', 'icmsf');

    classificationBanner(
      ctx,
      { label: `${messagesEn.planClassLabel(resolvedCase.planClass)} — ${messagesEn.planClassDescription(resolvedCase.planClass)}`, color: REPORT_COLORS.brand, bg: REPORT_COLORS.panelTint },
      'Sampling Plan',
    );

    const caseRows: KVRow[] = [
      ['Test Method Type', TEST_TYPE_REPORT_LABEL[testType]],
      ['Degree of Health Hazard', messagesEn.hazardLevels[hazardLevel]],
      ['Conditions after Sampling', messagesEn.conditionEffects[conditionEffect]],
      ['ICMSF Case', messagesEn.resolvedCaseLabel(resolvedCase.case)],
    ];
    const planRows: KVRow[] = [
      ['Plan Class', messagesEn.planClassLabel(resolvedCase.planClass)],
      [messagesEn.sampleSizeLabel, String(resolvedCase.n)],
      [messagesEn.acceptNumberLabel, String(resolvedCase.c)],
      [messagesEn.mLabel, limits.m !== null ? String(limits.m) : '—'],
      [messagesEn.MLabel, resolvedCase.planClass === 3 ? (limits.M !== null ? String(limits.M) : '—') : messagesEn.MNotApplicable],
    ];
    twoColumnTables(ctx, 'Case Selection', caseRows, 'Sampling Plan', planRows);

    calloutBox(
      ctx,
      resolvedCase.planClass === 2
        ? messagesEn.planSummary(resolvedCase.n, resolvedCase.c)
        : messagesEn.threeClassSummary(resolvedCase.n, resolvedCase.c),
      'info',
    );

    if (plan.ocCurveAvailable && ocCurve) {
      drawOcCurvePdf(ctx, ocCurve, riskCheckP, riskCheckPa);
      if (riskCheckPa !== null) {
        calloutBox(
          ctx,
          `At ${riskCheckP}% actual defective, this plan accepts the lot ${Math.round(riskCheckPa * 1000) / 10}% of the time.`,
          'warn',
        );
      }
    } else {
      calloutBox(ctx, messagesEn.ocCurveUnavailable3Class, 'info');
    }

    interpretationBox(ctx, 'Methodology', messagesEn.methodologyNote, 'info');

    finalizeReport(ctx);
    ctx.pdf.save('icmsf-sampling-plan.pdf');
  }

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_icmsf" />

      <div className="qh-main" style={s.main}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{messages.appTitle}</h1>
          <p style={{ fontSize: 13, color: c.muted }}>{messages.appSubtitle}</p>
          <VerifiedBadge
            theme={theme}
            standard="ICMSF Table 6-1"
            detail="Case selection data cross-verified against the National Academies
              Press reproduction of ICMSF's Table 6-1 (source: ICMSF 1974, p.60),
              and cross-checked against every explicit case/n/c example found
              across ICMSF's own commodity chapters (raw meat, poultry, dairy,
              pet foods). The OC curve uses the standard binomial acceptance-
              sampling model, numerically verified against ICMSF's own worked
              examples (n=10,c=2 and n=5,c=0)."
          />
        </div>

        {/* Step 0 — Test method type */}
        <div style={s.card}>
          <div style={s.sectionTitle}>{messages.step0Title}</div>
          <div>
            <div style={s.label}>{messages.testTypeLabel}</div>
            <p style={{ fontSize: 12, color: c.muted, marginTop: 0, marginBottom: 6 }}>{messages.testTypeHelp}</p>
            <select
              style={s.select}
              value={testType}
              onChange={(e) => handleTestTypeChange(e.target.value as TestType)}
            >
              <option value="">—</option>
              {TEST_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {messages.testTypes[t]}
                </option>
              ))}
            </select>
          </div>
          {!testType && (
            <p style={{ fontSize: 13, color: c.muted, marginTop: 14 }}>{messages.testTypeRequired}</p>
          )}
        </div>

        {/* Step 1 — Case selector */}
        {testType && (
        <div style={s.card}>
          <div style={s.sectionTitle}>{messages.step1Title}</div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={s.label}>{messages.hazardLevelLabel}</div>
              <p style={{ fontSize: 12, color: c.muted, marginTop: 0, marginBottom: 6 }}>
                {messages.hazardLevelHelp}
              </p>
              <select
                style={s.select}
                value={hazardLevel}
                onChange={(e) => setHazardLevel(e.target.value as HazardLevel)}
              >
                <option value="">—</option>
                {availableHazardLevels.map((h) => (
                  <option key={h} value={h}>
                    {messages.hazardLevels[h]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={s.label}>{messages.conditionEffectLabel}</div>
              <p style={{ fontSize: 12, color: c.muted, marginTop: 0, marginBottom: 6 }}>
                {messages.conditionEffectHelp}
              </p>
              <select
                style={s.select}
                value={conditionEffect}
                onChange={(e) => setConditionEffect(e.target.value as ConditionEffect)}
              >
                <option value="">—</option>
                {CONDITION_EFFECT_ORDER.map((ce) => (
                  <option key={ce} value={ce}>
                    {messages.conditionEffects[ce]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!resolvedCase && (
            <p style={{ fontSize: 13, color: c.muted, marginTop: 14 }}>{messages.incompleteSelection}</p>
          )}

          {resolvedCase && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 16px',
                background: c.surface2,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ ...s.badge, background: c.accent, color: theme === 'dark' ? '#04211f' : '#fff' }}>
                {messages.resolvedCaseLabel(resolvedCase.case)}
              </span>
              <span style={{ fontSize: 13, color: c.text }}>
                {messages.planClassLabel(resolvedCase.planClass)}
                <span style={{ color: c.muted, fontWeight: 400 }}>
                  {' '}— {messages.planClassDescription(resolvedCase.planClass)}
                </span>
              </span>
              <span style={{ fontSize: 13, color: c.muted }}>
                {messages.sampleSizeLabel}: <b style={{ color: c.text }}>{resolvedCase.n}</b>
              </span>
              <span style={{ fontSize: 13, color: c.muted }}>
                {messages.acceptNumberLabel}: <b style={{ color: c.text }}>{resolvedCase.c}</b>
              </span>
            </div>
          )}
        </div>
        )}

        {/* Step 2 — limits */}
        {resolvedCase && (
          <div style={s.card}>
            <div style={s.sectionTitle}>{messages.step2Title}</div>
            <p style={{ fontSize: 12, color: c.muted, marginTop: 0, marginBottom: 14 }}>{messages.step2Help}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <div>
                <div style={s.label}>{messages.mLabel}</div>
                <input
                  type="number"
                  style={s.input}
                  placeholder={messages.unitPlaceholder}
                  value={limits.m ?? ''}
                  onChange={(e) =>
                    setLimits((prev) => ({ ...prev, m: e.target.value === '' ? null : Number(e.target.value) }))
                  }
                />
                <p style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>{messages.mHelp}</p>
              </div>

              <div>
                <div style={s.label}>{messages.MLabel}</div>
                {resolvedCase.planClass === 3 ? (
                  <>
                    <input
                      type="number"
                      style={s.input}
                      placeholder={messages.unitPlaceholder}
                      value={limits.M ?? ''}
                      onChange={(e) =>
                        setLimits((prev) => ({ ...prev, M: e.target.value === '' ? null : Number(e.target.value) }))
                      }
                    />
                    <p style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>{messages.MHelp}</p>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: c.muted, fontStyle: 'italic' }}>{messages.MNotApplicable}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — plan summary */}
        {plan && (
          <div style={s.card}>
            <div style={s.sectionTitle}>{messages.step3Title}</div>
            <p style={{ fontSize: 14, color: c.text }}>
              {plan.icmsfCase.planClass === 2
                ? messages.planSummary(plan.icmsfCase.n, plan.icmsfCase.c)
                : messages.threeClassSummary(plan.icmsfCase.n, plan.icmsfCase.c)}
            </p>

            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Case</th>
                  <th style={s.th}>Plan</th>
                  <th style={s.th}>n</th>
                  <th style={s.th}>c</th>
                  <th style={s.th}>m</th>
                  <th style={s.th}>M</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={s.td}>{plan.icmsfCase.case}</td>
                  <td style={s.td}>{plan.icmsfCase.planClass}-class</td>
                  <td style={s.td}>{plan.icmsfCase.n}</td>
                  <td style={s.td}>{plan.icmsfCase.c}</td>
                  <td style={s.td}>{limits.m ?? '—'}</td>
                  <td style={s.td}>{plan.icmsfCase.planClass === 3 ? (limits.M ?? '—') : messages.MNotApplicable}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* OC curve */}
        {plan && (
          <div style={s.chartWrap}>
            <div style={s.sectionTitle}>{messages.ocCurveTitle}</div>
            <p style={{ fontSize: 12, color: c.muted, marginTop: 0, marginBottom: 14 }}>
              {messages.ocCurveSubtitle}
            </p>

            {!plan.ocCurveAvailable && (
              <p style={{ fontSize: 13, color: c.muted }}>{messages.ocCurveUnavailable3Class}</p>
            )}

            {plan.ocCurveAvailable && ocCurve && (
              <>
                <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={messages.ocCurveTitle}>
                  {/* Y gridlines + labels (0%, 25%, 50%, 75%, 100%) */}
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                    <g key={frac}>
                      <line
                        x1={PAD.left}
                        x2={CHART_W - PAD.right}
                        y1={yForPa(frac)}
                        y2={yForPa(frac)}
                        stroke={c.grid}
                        strokeWidth={1}
                      />
                      <text x={PAD.left - 8} y={yForPa(frac) + 4} fontSize={10} fill={c.muted} textAnchor="end">
                        {Math.round(frac * 100)}%
                      </text>
                    </g>
                  ))}
                  {/* X gridlines + labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                    <g key={`x-${frac}`}>
                      <text x={xForP(frac)} y={CHART_H - PAD.bottom + 18} fontSize={10} fill={c.muted} textAnchor="middle">
                        {Math.round(frac * 100)}%
                      </text>
                    </g>
                  ))}
                  <text
                    x={PAD.left + PLOT_W / 2}
                    y={CHART_H - 4}
                    fontSize={11}
                    fill={c.muted}
                    textAnchor="middle"
                  >
                    {messages.ocCurveXAxisLabel}
                  </text>
                  <text
                    x={-(PAD.top + PLOT_H / 2)}
                    y={14}
                    fontSize={11}
                    fill={c.muted}
                    textAnchor="middle"
                    transform="rotate(-90)"
                  >
                    {messages.ocCurveYAxisLabel}
                  </text>

                  <path d={linePath} fill="none" stroke={c.accent} strokeWidth={2.5} />

                  {/* Risk-check marker */}
                  {riskCheckPa !== null && (
                    <circle
                      cx={xForP(riskCheckP / 100)}
                      cy={yForPa(riskCheckPa)}
                      r={5}
                      fill={c.amber}
                      stroke={theme === 'dark' ? '#000' : '#fff'}
                      strokeWidth={1.5}
                    />
                  )}
                </svg>

                {/* Consumer-risk calculator */}
                <div
                  style={{
                    marginTop: 16,
                    padding: '14px 16px',
                    background: c.surface2,
                    border: `1px solid ${c.border}`,
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 8 }}>
                    {messages.consumerRiskCalculatorTitle}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: c.muted }}>{messages.consumerRiskInputLabel}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      style={{ ...s.input, width: 90 }}
                      value={riskCheckP}
                      onChange={(e) => setRiskCheckP(Math.min(100, Math.max(0, Number(e.target.value))))}
                    />
                    <span style={{ fontSize: 13, color: c.text }}>
                      {riskCheckPa !== null &&
                        messages.consumerRiskOutputLabel(riskCheckP, Math.round(riskCheckPa * 1000) / 10)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Methodology note */}
        {plan && (
          <p style={{ fontSize: 11, color: c.muted, opacity: 0.85 }}>{messages.methodologyNote}</p>
        )}

        {/* Export */}
        {plan && (
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
                tool="icmsf"
                defaultName={`ICMSF — ${new Date().toLocaleDateString('en-US')}`}
                getPayload={() =>
                  !plan ? null : { input_data: { testType, hazardLevel, conditionEffect, limits }, results: plan }
                }
              />
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: c.muted, opacity: 0.75 }}>{messages.footerNote}</p>
      </div>
    </div>
  );
}
