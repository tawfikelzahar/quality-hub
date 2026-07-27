'use client';

import { useState } from 'react';
import Link from 'next/link';
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
} from '@/lib/aql/calculator';
import { messages } from '@/lib/aql/messages';
import { COLORS, getSharedStyles, type ThemeMode } from '@/lib/theme';

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

export default function AQLPage() {
  const [theme, setTheme] = useState<ThemeMode>('dark');
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

  function exportCSV() {
    const lines: string[] = [
      'Stage,Lot Size,Level,Inspection Type,Code Letter,Sample Size,Defect Class,AQL%,Used Letter,Required Sample,Actual Sample,Ac,Re,Full Lot Inspection,Note',
    ];
    results.forEach((r) => {
      r.defects.forEach((d) => {
        const plan = d.plan;
        lines.push(
          [
            r.stageName,
            r.lotSize,
            r.level,
            r.inspectionType,
            r.codeLetter ?? '',
            r.sampleSize ?? '',
            d.name,
            d.aql,
            plan?.usedLetter ?? '',
            plan?.requiredSampleSize ?? '',
            plan?.actualSampleSize ?? '',
            plan && !plan.noVerifiedData ? plan.ac : '',
            plan && !plan.noVerifiedData ? plan.re : '',
            plan?.fullLotInspection ? 'Yes' : 'No',
            plan?.switchNote ?? '',
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        );
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aql-sampling-plan.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const warningText: React.CSSProperties = { fontSize: 12, color: c.amber, marginTop: 2 };
  const dangerText: React.CSSProperties = { fontSize: 12, color: c.danger, marginTop: 2 };

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span style={s.separator}>/</span>
          <span style={s.breadcrumb}>{messages.appTitle}</span>
        </div>
        <div style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? messages.darkModeToggleOff : messages.darkModeToggleOn}
          </button>
          <button style={s.exportBtn} onClick={exportCSV}>
            {messages.exportCsv}
          </button>
          <Link href="/login" style={s.signInLink}>
            Sign In
          </Link>
          <Link href="/pricing" style={s.ctaBtn}>
            Get Pro →
          </Link>
        </div>
      </nav>

      <div style={s.main}>
        <div>
          <p style={{ fontSize: 13, color: c.muted }}>{messages.appSubtitle}</p>
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
                    borderBottom: `1px solid transparent`,
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
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>{messages.defectClassLabel}</th>
                        <th style={s.th}>{messages.aqlPercentLabel}</th>
                        <th style={s.th}>{messages.requiredSampleLabel}</th>
                        <th style={s.th}>{messages.actualSampleLabel}</th>
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
                              {plan ? plan.requiredSampleSize : messages.noDataPlaceholder}
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

                  {result.defects.some((d) => d.plan?.switchNote) &&
                    result.defects
                      .filter((d) => d.plan?.switchNote)
                      .map((d) => (
                        <p key={d.id} style={warningText}>
                          ⚠ {d.name}: {d.plan?.switchNote}
                        </p>
                      ))}

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
