'use client';

import { useState } from 'react';
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

const LEVELS: InspectionLevel[] = ['S1', 'S2', 'S3', 'S4', 'I', 'II', 'III'];
const TYPES: InspectionType[] = ['Normal', 'Tightened', 'Reduced'];

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
  const [dark, setDark] = useState(false);
  const [rows, setRows] = useState<InspectionRowInput[]>([
    makeDefaultRow('Incoming Inspection'),
  ]);

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
      'Stage,Lot Size,Level,Inspection Type,Code Letter,Sample Size,Defect Class,AQL%,Used Letter,Used Sample Size,Ac,Re,100% Inspection,Note',
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
            plan?.usedSampleSize ?? '',
            plan && plan.ac !== -1 ? plan.ac : '',
            plan && plan.re !== -1 ? plan.re : '',
            plan?.requires100Percent ? '100% Inspection (sample = lot size)' : '',
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

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold">AQL Sampling Plan Calculator</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                ISO 2859-1 / ANSI ASQ Z1.4 — Single Sampling Plans
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDark((d) => !d)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {dark ? '☀️ Light' : '🌙 Dark'}
              </button>
              <button
                onClick={exportCSV}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {rows.map((row, rowIdx) => {
              const result = results[rowIdx];
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <input
                      value={row.stageName}
                      onChange={(e) => updateRow(row.id, { stageName: e.target.value })}
                      className="text-lg font-medium bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-blue-500 outline-none px-1"
                    />
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        Remove stage
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <label className="text-sm">
                      <span className="block text-zinc-500 dark:text-zinc-400 mb-1">Lot Size</span>
                      <input
                        type="number"
                        min={2}
                        value={row.lotSize}
                        onChange={(e) => updateRow(row.id, { lotSize: Number(e.target.value) })}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-zinc-500 dark:text-zinc-400 mb-1">
                        Inspection Level
                      </span>
                      <select
                        value={row.level}
                        onChange={(e) =>
                          updateRow(row.id, { level: e.target.value as InspectionLevel })
                        }
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5"
                      >
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="block text-zinc-500 dark:text-zinc-400 mb-1">
                        Inspection Type
                      </span>
                      <select
                        value={row.inspectionType}
                        onChange={(e) =>
                          updateRow(row.id, { inspectionType: e.target.value as InspectionType })
                        }
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5"
                      >
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="text-sm">
                      <span className="block text-zinc-500 dark:text-zinc-400 mb-1">
                        Code Letter
                      </span>
                      <div className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 font-semibold">
                        {result.error
                          ? '—'
                          : `${result.codeLetter} (n=${result.sampleSize})`}
                      </div>
                    </div>
                  </div>

                  {result.error && (
                    <p className="text-sm text-red-500 mb-4">{result.error}</p>
                  )}

                  {!result.error && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                            <th className="py-2 pr-2">Defect Class</th>
                            <th className="py-2 pr-2">AQL %</th>
                            <th className="py-2 pr-2">Sample (n)</th>
                            <th className="py-2 pr-2">Ac</th>
                            <th className="py-2 pr-2">Re</th>
                            <th className="py-2 pr-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.defects.map((d) => (
                            <tr key={d.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                              <td className="py-2 pr-2">
                                <input
                                  value={d.name}
                                  onChange={(e) =>
                                    updateDefect(row.id, d.id, { name: e.target.value })
                                  }
                                  className="w-28 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-blue-500 outline-none"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <select
                                  value={d.aql}
                                  onChange={(e) =>
                                    updateDefect(row.id, d.id, { aql: Number(e.target.value) })
                                  }
                                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1"
                                >
                                  {AQL_VALUES.map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 pr-2 font-medium">
                                {d.plan?.usedSampleSize ?? '—'}
                              </td>
                              <td className="py-2 pr-2 font-semibold text-emerald-600 dark:text-emerald-400">
                                {d.plan?.ac !== undefined && d.plan.ac !== -1 ? d.plan.ac : '—'}
                              </td>
                              <td className="py-2 pr-2 font-semibold text-red-600 dark:text-red-400">
                                {d.plan?.re !== undefined && d.plan.re !== -1 ? d.plan.re : '—'}
                              </td>
                              <td className="py-2 pr-2">
                                <button
                                  onClick={() => removeDefect(row.id, d.id)}
                                  className="text-zinc-400 hover:text-red-500 text-xs"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {result.defects.some((d) => d.plan?.switchNote) && (
                        <div className="mt-3 space-y-1">
                          {result.defects
                            .filter((d) => d.plan?.switchNote)
                            .map((d) => (
                              <p
                                key={d.id}
                                className="text-xs text-amber-600 dark:text-amber-400"
                              >
                                ⚠ {d.name}: {d.plan?.switchNote}
                              </p>
                            ))}
                        </div>
                      )}
                      {result.defects.some((d) => d.plan?.ac === -1) && (
                        <p className="mt-2 text-xs text-red-500">
                          ⚠ لا توجد بيانات موثقة بعد لهذا الـ AQL عند أي حجم عينة — القيم غير متاحة
                          (يحتاج مصدر رسمي إضافي للتحقق).
                        </p>
                      )}
                      {result.defects.some(
                        (d) => d.plan?.requires100Percent && d.plan.ac !== -1,
                      ) && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          ℹ حجم العينة المطلوب أكبر من أو يساوي حجم الشحنة لأحد أصناف العيوب — يتم
                          فحص 100% من الشحنة (كل الوحدات) باستخدام حدود القبول/الرفض الموضحة أعلاه.
                        </p>
                      )}
                      <button
                        onClick={() => addDefect(row.id)}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Add defect class
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={addRow}
            className="mt-6 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 w-full"
          >
            + Add inspection stage
          </button>

          <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-600">
            Based on ISO 2859-1 / ANSI ASQ Z1.4. AQL range supported: 0.010% – 6.5%. Switching
            rules are applied automatically when no direct plan exists for a given code
            letter/AQL combination.
          </p>
        </div>
      </div>
    </div>
  );
}
