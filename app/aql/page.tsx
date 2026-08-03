'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
  AQL_VALUES,
  DEFAULT_DEFECT_CLASSES,
  type InspectionLevel,
  type InspectionType,
} from '@/lib/aql/tables';
import {
  computeRow,
  type DefectClassInput,
  type InspectionRowInput,
  type InspectionRowResult,
} from '@/lib/aql/calculator';
import { messages } from '@/lib/aql/messages';
import { COLORS, getSharedStyles, usePersistedTheme, type ThemeMode } from '@/lib/theme';
import AuthStatus from '@/components/AuthStatus';

const LEVELS: InspectionLevel[] = ['S1', 'S2', 'S3', 'S4', 'I', 'II', 'III'];
const TYPES: InspectionType[] = ['Normal', 'Tightened', 'Reduced'];
const MIN_LOT_SIZE = 2;

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function makeDefaultDefects(): DefectClassInput[] {
  return DEFAULT_DEFECT_CLASSES.map((d) => ({ id: nextId('defect'), name: d.name, aql: d.aql }));
}

function makeDefaultRow(stageName: string): InspectionRowInput {
  return {
    id: nextId('row'),
    stageName,
    lotSize: 3000,
    level: 'II',
    inspectionType: 'Normal',
    defects: makeDefaultDefects(),
  };
}

/** One flattened line per defect class, used by every export format. */
function flattenResults(results: InspectionRowResult[]) {
  const out: {
    stage: string;
    lotSize: number;
    level: string;
    inspectionType: string;
    codeLetter: string;
    defectClass: string;
    aql: number;
    sampleSize: number | string;
    ac: number | string;
    re: number | string;
    note: string;
  }[] = [];

  results.forEach((r) => {
    r.defects.forEach((d) => {
      const plan = d.plan;
      const notes: string[] = [];
      if (plan?.switchNote) notes.push(plan.switchNote);
      if (plan?.fullLotInspection && !plan.noVerifiedData) {
        notes.push(messages.fullLotInspectionNote(plan.requiredSampleSize, r.lotSize));
      }
      if (plan?.noVerifiedData) notes.push(messages.noVerifiedDataWarning(d.name));

      out.push({
        stage: r.stageName,
        lotSize: r.lotSize,
        level: r.level,
        inspectionType: r.inspectionType,
        codeLetter: r.codeLetter ?? '',
        defectClass: d.name,
        aql: d.aql,
        sampleSize: plan ? plan.actualSampleSize : '',
        ac: plan && !plan.noVerifiedData ? plan.ac : '',
        re: plan && !plan.noVerifiedData ? plan.re : '',
        note: notes.join(' '),
      });
    });
  });

  return out;
}

export default function AQLPage() {
  const [theme, setTheme] = usePersistedTheme();
  const [rows, setRows] = useState<InspectionRowInput[]>([
    makeDefaultRow('Incoming Inspection'),
  ]);

  const c = COLORS[theme];
  const s = getSharedStyles(theme);

  function updateRow(id: string, patch: Partial<InspectionRowInput>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function updateDefect(rowId: string, defectId: string, patch: Partial<DefectClassInput>) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              defects: r.defects.map((d) => (d.id === defectId ? { ...d, ...patch } : d)),
            }
          : r,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, makeDefaultRow(`Inspection Stage ${prev.length + 1}`)]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function addDefect(rowId: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, defects: [...r.defects, { id: nextId('defect'), name: 'Custom', aql: 1.0 }] }
          : r,
      ),
    );
  }

  function removeDefect(rowId: string, defectId: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, defects: r.defects.filter((d) => d.id !== defectId) } : r,
      ),
    );
  }

  const results = rows.map(computeRow);

  // ── Export: CSV ──────────────────────────────────────────────────────
  function exportCSV() {
    const flat = flattenResults(results);
    const header = 'Stage,Lot Size,Level,Inspection Type,Code Letter,Defect Class,AQL%,Sample (n),Ac,Re,Note\n';
    const body = flat
      .map((r) =>
        [r.stage, r.lotSize, r.level, r.inspectionType, r.codeLetter, r.defectClass, r.aql, r.sampleSize, r.ac, r.re, r.note]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aql-sampling-plan.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export: Excel ────────────────────────────────────────────────────
  function exportExcel() {
    const flat = flattenResults(results);
    const data = flat.map((r) => ({
      Stage: r.stage,
      'Lot Size': r.lotSize,
      Level: r.level,
      'Inspection Type': r.inspectionType,
      'Code Letter': r.codeLetter,
      'Defect Class': r.defectClass,
      'AQL %': r.aql,
      'Sample (n)': r.sampleSize,
      Ac: r.ac,
      Re: r.re,
      Note: r.note,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AQL Sampling Plan');
    XLSX.writeFile(wb, 'aql-sampling-plan.xlsx');
  }

  // ── Export: PNG ──────────────────────────────────────────────────────
  // Drawn directly on a canvas (same "draw the report, don't screenshot
  // the page" approach used for the PDF), so no extra dependency is needed.
  function exportPNG() {
    const flat = flattenResults(results);
    const rowH = 24;
    const colX = [16, 190, 260, 340, 440, 590, 650, 710];
    const headers = ['Stage', 'Lot Size', 'Level', 'Code Letter', 'Defect Class', 'AQL%', 'Ac', 'Re'];
    const width = 900;
    const height = 90 + rowH * (flat.length + 1) + 20;

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

    let y = 80;
    ctx.fillStyle = '#1e2d40';
    ctx.fillRect(16, y, width - 32, rowH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px system-ui, sans-serif';
    headers.forEach((h, i) => ctx.fillText(h, colX[i] + 4, y + 16));
    y += rowH;

    ctx.font = '12px system-ui, sans-serif';
    flat.forEach((r, i) => {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(16, y, width - 32, rowH);
      }
      ctx.fillStyle = '#e2e8f0';
      const cells = [r.stage, String(r.lotSize), r.level, r.codeLetter, r.defectClass, String(r.aql), String(r.ac), String(r.re)];
      cells.forEach((v, ci) => ctx.fillText(v.slice(0, 22), colX[ci] + 4, y + 16));
      y += rowH;
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aql-sampling-plan.png';
    a.click();
  }

  // ── Export: PDF ──────────────────────────────────────────────────────
  // Same manual-table approach used in the DPMO tool's PDF export.
  function exportPDF() {
    const flat = flattenResults(results);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(messages.pdfReportTitle, margin, y);
    y += 10;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100);
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y + 12);
    y += 34;

    const colX = [margin, margin + 90, margin + 160, margin + 210, margin + 270, margin + 360, margin + 400, margin + 440];
    const rowHeight = 20;

    const drawHeader = () => {
      pdf.setFillColor(230, 230, 230);
      pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(0);
      const headers = ['Stage', 'Lot Size', 'Level', 'Code Letter', 'Defect Class', 'AQL%', 'Ac', 'Re'];
      headers.forEach((h, i) => pdf.text(h, colX[i] + 4, y + 14));
      y += rowHeight;
    };

    drawHeader();
    pdf.setFont('helvetica', 'normal');
    flat.forEach((r) => {
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
        drawHeader();
      }
      pdf.setTextColor(0);
      const cells = [r.stage, String(r.lotSize), r.level, r.codeLetter, r.defectClass, String(r.aql), String(r.ac), String(r.re)];
      cells.forEach((v, i) => pdf.text(v.slice(0, 18), colX[i] + 4, y + 14));
      y += rowHeight;
    });

    pdf.save('aql-sampling-plan.pdf');
  }

  const warningText: React.CSSProperties = { fontSize: 12, color: c.amber, marginTop: 2 };
  const dangerText: React.CSSProperties = { fontSize: 12, color: c.danger, marginTop: 2 };

  return (
    <div style={s.page}>
      <nav className="qh-nav" style={s.nav}>
        <div className="qh-nav-left" style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span className="qh-breadcrumb-sep" style={s.separator}>/</span>
          <span className="qh-breadcrumb" style={s.breadcrumb}>{messages.appTitle}</span>
        </div>
        <div className="qh-nav-right" style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? messages.darkModeToggleOff : messages.darkModeToggleOn}
          </button>
          <AuthStatus />
          <Link href="/pricing" style={s.ctaBtn}>
            Get Pro →
          </Link>
        </div>
      </nav>

      <div className="qh-main" style={s.main}>
        <div>
          <p style={{ fontSize: 13, color: c.muted }}>{messages.appSubtitle}</p>
        </div>

        <div style={s.card}>
          <div style={s.sectionTitle}>{messages.exportSectionTitle}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            <button style={s.exportBtn} onClick={exportCSV}>
              📄 {messages.exportCsvButton}
            </button>
            <button style={s.exportBtn} onClick={exportExcel}>
              📊 {messages.exportExcelButton}
            </button>
            <button style={s.exportBtn} onClick={exportPNG}>
              🖼️ {messages.exportPngButton}
            </button>
            <button style={s.exportBtn} onClick={exportPDF}>
              📕 {messages.exportPdfButton}
            </button>
          </div>
        </div>

        {rows.map((row, rowIdx) => {
          const result = results[rowIdx];
          return (
            <div key={row.id} style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <input
                  value={row.stageName}
                  onChange={(e) => updateRow(row.id, { stageName: e.target.value })}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: c.text,
                    fontSize: 17,
                    fontWeight: 600,
                    outline: 'none',
                    padding: '2px 2px',
                  }}
                />
                {rows.length > 1 && (
                  <button
                    onClick={() => removeRow(row.id)}
                    style={{ background: 'transparent', border: 'none', color: c.danger, fontSize: 13, cursor: 'pointer' }}
                  >
                    {messages.removeStage}
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                <label>
                  <div style={s.label}>{messages.lotSizeLabel}</div>
                  <input
                    type="number"
                    min={MIN_LOT_SIZE}
                    value={row.lotSize}
                    onChange={(e) => updateRow(row.id, { lotSize: Number(e.target.value) })}
                    style={s.input}
                  />
                </label>
                <label>
                  <div style={s.label}>{messages.inspectionLevelLabel}</div>
                  <select
                    value={row.level}
                    onChange={(e) => updateRow(row.id, { level: e.target.value as InspectionLevel })}
                    style={s.select}
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <div style={s.label}>{messages.inspectionTypeLabel}</div>
                  <select
                    value={row.inspectionType}
                    onChange={(e) => updateRow(row.id, { inspectionType: e.target.value as InspectionType })}
                    style={s.select}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {messages.inspectionTypes[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <div style={s.label}>{messages.codeLetterLabel}</div>
                  <div
                    style={{
                      ...s.input,
                      background: c.surface2,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {result.error
                      ? messages.codeLetterUnavailable
                      : messages.codeLetterValue(result.codeLetter as string, result.sampleSize as number)}
                  </div>
                </div>
              </div>

              {result.error && <p style={dangerText}>{result.error}</p>}

              {!result.error && (
                <div style={{ overflowX: 'auto' }}>
                  <div className="qh-table-wrap" style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>{messages.defectClassLabel}</th>
                        <th style={s.th}>{messages.aqlPercentLabel}</th>
                        <th style={s.th}>{messages.sampleSizeLabel}</th>
                        <th style={s.th}>{messages.acceptNumberLabel}</th>
                        <th style={s.th}>{messages.rejectNumberLabel}</th>
                        <th style={s.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.defects.map((d) => {
                        const plan = d.plan;
                        const hasData = !!plan && !plan.noVerifiedData;
                        return (
                          <tr key={d.id}>
                            <td style={s.td}>
                              <input
                                value={d.name}
                                onChange={(e) => updateDefect(row.id, d.id, { name: e.target.value })}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: c.text,
                                  fontSize: 13,
                                  outline: 'none',
                                  width: 100,
                                }}
                              />
                            </td>
                            <td style={s.td}>
                              <select
                                value={d.aql}
                                onChange={(e) => updateDefect(row.id, d.id, { aql: Number(e.target.value) })}
                                style={{ ...s.select, width: 'auto', padding: '5px 8px' }}
                              >
                                {AQL_VALUES.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ ...s.td, fontWeight: 600 }}>
                              {plan ? plan.actualSampleSize : messages.noDataPlaceholder}
                            </td>
                            <td style={{ ...s.td, fontWeight: 700, color: c.accent }}>
                              {hasData ? plan!.ac : messages.noDataPlaceholder}
                            </td>
                            <td style={{ ...s.td, fontWeight: 700, color: c.danger }}>
                              {hasData ? plan!.re : messages.noDataPlaceholder}
                            </td>
                            <td style={s.td}>
                              <button
                                onClick={() => removeDefect(row.id, d.id)}
                                style={{ background: 'transparent', border: 'none', color: c.muted, cursor: 'pointer', fontSize: 12 }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>

                  {result.defects.some((d) => d.plan?.switchNote) &&
                    result.defects
                      .filter((d) => d.plan?.switchNote)
                      .map((d) => (
                        <p key={d.id} style={warningText}>
                          ⚠ {d.name}: {d.plan?.switchNote}
                        </p>
                      ))}

                  {/* Shown only when the required sample size differs from what's actually inspected */}
                  {result.defects.some((d) => d.plan?.fullLotInspection && !d.plan?.noVerifiedData) &&
                    result.defects
                      .filter((d) => d.plan?.fullLotInspection && !d.plan?.noVerifiedData)
                      .map((d) => (
                        <p key={d.id} style={warningText}>
                          {messages.fullLotInspectionNote(d.plan!.requiredSampleSize, row.lotSize)}
                        </p>
                      ))}

                  {result.defects.some((d) => d.plan?.noVerifiedData) &&
                    result.defects
                      .filter((d) => d.plan?.noVerifiedData)
                      .map((d) => (
                        <p key={d.id} style={dangerText}>
                          {messages.noVerifiedDataWarning(d.name)}
                        </p>
                      ))}

                  <button onClick={() => addDefect(row.id)} style={{ ...s.addBtn, marginTop: 12 }}>
                    {messages.addDefectClass}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={addRow}
          style={{
            background: 'transparent',
            border: `1px dashed ${c.border}`,
            borderRadius: 12,
            padding: '14px',
            color: c.muted,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {messages.addInspectionStage}
        </button>

        <p style={{ fontSize: 11, color: c.muted, opacity: 0.7 }}>{messages.footerNote}</p>
      </div>
    </div>
  );
}
