// ─────────────────────────────────────────────────────────────────────────
// Shared glue for the Chart.js watermark (see lib/watermarkPlugin.ts).
//
// Importing this file registers the plugin once with Chart.js, so a page only
// needs `import { watermarkOptions, watermarkLayout, withWatermarksDisabled }
// from '@/lib/watermarkHelpers'` — no per-page Chart.register() call.
//
//   options={{ plugins: { ..., watermark: watermarkOptions('normal') },
//              layout: watermarkLayout(), ... }}
//
//   const exportPDF = () => withWatermarksDisabled(allCharts, runExportPDF)
//
// Free users keep the watermark (live view + free PNG). Pro PDF / Excel / PNG
// exports turn it off for the duration of the export so images come out clean.
// ─────────────────────────────────────────────────────────────────────────

import { Chart as ChartJSCore } from 'chart.js'
import { watermarkPlugin, WATERMARK_STRIP_HEIGHT, type WatermarkDensity } from '@/lib/watermarkPlugin'

ChartJSCore.register(watermarkPlugin)

/** Value for `options.plugins.watermark`. */
export function watermarkOptions(density: WatermarkDensity = 'normal') {
  return { density, enabled: true }
}

/**
 * Value for `options.layout` — reserves room under the x-axis for the brand
 * strip. Returns a fresh object each call because withWatermarksDisabled()
 * temporarily mutates `padding.bottom` on the chart's own copy.
 */
export function watermarkLayout() {
  return { padding: { bottom: WATERMARK_STRIP_HEIGHT } }
}

// Minimal structural type so refs of any chart kind (line / bar / scatter)
// can be passed in without per-page casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChart = ChartJSCore<any, any, any>

/**
 * Switches the watermark off on every given chart, runs `fn` (an export that
 * reads each canvas via toBase64Image()), then switches it back on — even if
 * `fn` throws. `chart.update('none')` skips animation so the off/on cycle is
 * synchronous and invisible. Null refs (unmounted charts) are skipped.
 *
 * Several charts on one page often share a single options object (e.g. the
 * I-Chart and MR-Chart in SPC Engine). So the original values are snapshotted
 * per *object*, before anything is mutated — otherwise the second chart would
 * record the already-disabled state and the watermark would stay off on screen
 * after the export.
 */
export async function withWatermarksDisabled<T>(
  charts: Array<AnyChart | null | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const active = charts.filter((chart): chart is AnyChart => {
    const plugins = chart?.options.plugins as Record<string, unknown> | undefined
    return Boolean(plugins?.watermark)
  })

  const watermarkStates = new Map<{ enabled?: boolean }, boolean | undefined>()
  const paddingStates = new Map<{ bottom?: number }, number | undefined>()
  active.forEach((chart) => {
    const wm = (chart.options.plugins as Record<string, { enabled?: boolean }>).watermark
    if (!watermarkStates.has(wm)) watermarkStates.set(wm, wm.enabled)
    const padding = chart.options.layout?.padding
    if (padding && typeof padding === 'object' && !paddingStates.has(padding)) {
      paddingStates.set(padding as { bottom?: number }, (padding as { bottom?: number }).bottom)
    }
  })

  watermarkStates.forEach((_, wm) => { wm.enabled = false })
  paddingStates.forEach((_, padding) => { padding.bottom = 0 })
  active.forEach((chart) => chart.update('none'))

  try {
    return await fn()
  } finally {
    watermarkStates.forEach((enabled, wm) => { wm.enabled = enabled ?? true })
    paddingStates.forEach((bottom, padding) => { padding.bottom = bottom })
    active.forEach((chart) => chart.update('none'))
  }
}
