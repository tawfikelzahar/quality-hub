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
 */
export async function withWatermarksDisabled<T>(
  charts: Array<AnyChart | null | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const restoreFns: Array<() => void> = []

  charts.forEach((chart) => {
    if (!chart) return
    const plugins = chart.options.plugins as Record<string, { enabled?: boolean }> | undefined
    if (!plugins?.watermark) return
    const padding = chart.options.layout?.padding as { bottom?: number } | undefined
    const previousEnabled = plugins.watermark.enabled
    const previousBottom = padding?.bottom
    plugins.watermark.enabled = false
    if (padding) padding.bottom = 0
    chart.update('none')
    restoreFns.push(() => {
      plugins.watermark.enabled = previousEnabled ?? true
      if (padding) padding.bottom = previousBottom
      chart.update('none')
    })
  })

  try {
    return await fn()
  } finally {
    restoreFns.forEach((restore) => restore())
  }
}
