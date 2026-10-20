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
 * CSS width every chart is redrawn at while an export reads it. The on-screen
 * width depends on the viewer's monitor (≈1500px on a wide desktop, ≈350px on
 * a phone), so without this the same report came out with microscopic labels
 * on one machine and cramped ones on another. 700px scales onto the A4 page
 * width (515 pt) at ~0.74×, so 10-11px chart labels print at ~7.5-8 pt.
 * (820px printed them at ~6.5 pt full width and ~3 pt in side-by-side pairs.)
 */
export const EXPORT_CHART_WIDTH = 700
/** Export pixel ratio, so a low-DPI laptop produces the same crisp images as a retina screen. */
const EXPORT_PIXEL_RATIO = 2

/**
 * Prepares charts for a Pro export, runs `fn` (which reads each canvas via
 * toBase64Image()), then restores everything — even if `fn` throws:
 *   1. watermark off and its bottom strip padding removed (watermarked charts),
 *   2. every chart redrawn at EXPORT_CHART_WIDTH × its current height, at 2× pixel ratio.
 * `update('none')` / `resize()` skip animation, so the swap is synchronous.
 * Null refs (unmounted charts) are skipped.
 *
 * Several charts on one page often share a single options object (e.g. the
 * I-Chart and MR-Chart in SPC Engine). So original values are snapshotted
 * per *object*, before anything is mutated — otherwise the second chart would
 * record the already-changed state and never get restored.
 */
export async function withWatermarksDisabled<T>(
  charts: Array<AnyChart | null | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const all = charts.filter((chart): chart is AnyChart => Boolean(chart))
  const watermarked = all.filter((chart) => {
    const plugins = chart.options.plugins as Record<string, { enabled?: boolean }> | undefined
    return plugins?.watermark?.enabled === true
  })

  const watermarkStates = new Map<{ enabled?: boolean }, boolean | undefined>()
  const paddingStates = new Map<{ bottom?: number }, number | undefined>()
  watermarked.forEach((chart) => {
    const wm = (chart.options.plugins as Record<string, { enabled?: boolean }>).watermark
    if (!watermarkStates.has(wm)) watermarkStates.set(wm, wm.enabled)
    const padding = chart.options.layout?.padding
    if (padding && typeof padding === 'object' && !paddingStates.has(padding)) {
      paddingStates.set(padding as { bottom?: number }, (padding as { bottom?: number }).bottom)
    }
  })
  // Option writes land on chart.config.options, which charts may share.
  const ratioStates = new Map<{ devicePixelRatio?: number }, number | undefined>()
  all.forEach((chart) => {
    const opts = chart.config.options as { devicePixelRatio?: number }
    if (!ratioStates.has(opts)) ratioStates.set(opts, opts.devicePixelRatio)
  })
  const heights = new Map(all.map((chart) => [chart, chart.height] as const))

  watermarkStates.forEach((_, wm) => { wm.enabled = false })
  paddingStates.forEach((_, padding) => { padding.bottom = 0 })
  ratioStates.forEach((_, opts) => { opts.devicePixelRatio = EXPORT_PIXEL_RATIO })
  all.forEach((chart) => {
    chart.update('none')
    chart.resize(EXPORT_CHART_WIDTH, heights.get(chart))
  })

  try {
    return await fn()
  } finally {
    watermarkStates.forEach((enabled, wm) => { wm.enabled = enabled })
    paddingStates.forEach((bottom, padding) => { padding.bottom = bottom })
    ratioStates.forEach((ratio, opts) => {
      if (ratio === undefined) delete opts.devicePixelRatio
      else opts.devicePixelRatio = ratio
    })
    all.forEach((chart) => {
      chart.update('none')
      chart.resize() // back to the container's size
    })
  }
}
