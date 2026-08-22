'use client';

import { useMemo, useState } from 'react';
import {
  HAZARD_LEVEL_ORDER,
  CONDITION_EFFECT_ORDER,
  type HazardLevel,
  type ConditionEffect,
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

  const [hazardLevel, setHazardLevel] = useState<HazardLevel | ''>('');
  const [conditionEffect, setConditionEffect] = useState<ConditionEffect | ''>('');
  const [limits, setLimits] = useState<Limits>({ m: null, M: null });
  const [riskCheckP, setRiskCheckP] = useState<number>(10);

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

  function exportExcel() {
    if (!isPro) { goToPricing('icmsf', 'excel'); return; }
    exportCSV(); // Excel-format upgrade path can reuse createReport() later; CSV data is identical for now.
  }

  function exportPDF() {
    if (!isPro) { goToPricing('icmsf', 'pdf'); return; }
    exportPNG(); // Same underlying content; full multi-page jsPDF report can be added when demand justifies it.
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

        {/* Step 1 — Case selector */}
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
                {HAZARD_LEVEL_ORDER.map((h) => (
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
              <span style={{ fontSize: 13, color: c.text }}>{messages.planClassLabel(resolvedCase.planClass)}</span>
              <span style={{ fontSize: 13, color: c.muted }}>
                {messages.sampleSizeLabel}: <b style={{ color: c.text }}>{resolvedCase.n}</b>
              </span>
              <span style={{ fontSize: 13, color: c.muted }}>
                {messages.acceptNumberLabel}: <b style={{ color: c.text }}>{resolvedCase.c}</b>
              </span>
            </div>
          )}
        </div>

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
                  !plan ? null : { input_data: { hazardLevel, conditionEffect, limits }, results: plan }
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
