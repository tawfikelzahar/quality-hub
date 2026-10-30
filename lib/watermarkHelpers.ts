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
import { COLORS } from '@/lib/theme'

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
/**
 * Export height = on-screen height × this factor (never below
 * EXPORT_MIN_HEIGHT). Full-width report charts were tall enough to leave
 * a chart alone on a page; 75% keeps label sizes unchanged (labels depend on
 * the width) while fitting two charts plus their tables on fewer pages.
 */
const EXPORT_HEIGHT_SCALE = 0.75
const EXPORT_MIN_HEIGHT = 200
/** Export pixel ratio, so a low-DPI laptop produces the same crisp images as a retina screen. */
const EXPORT_PIXEL_RATIO = 2

// ── Print colours ───────────────────────────────────────────────────────
// Reports, Excel sheets and PNGs are white paper. Charts on screen use the
// site theme, so an export made in the dark theme came out with light grey /
// white labels on white (unreadable axis names, legends and panel titles).
// While an export reads the canvases, every colour of the dark palette found
// in the charts' options and datasets is swapped for its light-theme
// counterpart, then restored. Plugins that draw their own text read their
// colours from their options (options.plugins.<id>.color) so they follow too.

const DARK_TO_LIGHT: [string, string][] = (Object.keys(COLORS.dark) as (keyof typeof COLORS.dark)[])
  .map(k => [COLORS.dark[k], COLORS.light[k]] as [string, string])
  .filter(([d, l]) => d.toLowerCase() !== l.toLowerCase())
  // longest first, so 'rgba(…)' and 8-digit hex variants are handled before shorter matches
  .sort((a, b) => b[0].length - a[0].length)

function toPrint(value: string): string {
  let out = value
  for (const [dark, light] of DARK_TO_LIGHT) {
    if (out.toLowerCase().includes(dark.toLowerCase())) {
      out = out.replace(new RegExp(dark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), light)
    }
  }
  return out
}

type Swap = { obj: Record<string, unknown> | unknown[]; key: string | number; old: unknown }

function swapColours(root: unknown, swaps: Swap[], seen: Set<unknown>) {
  if (!root || typeof root !== 'object' || seen.has(root)) return
  seen.add(root)
  // Never walk into live chart objects, DOM nodes or typed arrays
  if (root instanceof ChartJSCore || (typeof Node !== 'undefined' && root instanceof Node) || ArrayBuffer.isView(root)) return
  const entries: [string | number, unknown][] = Array.isArray(root) ? root.map((v, i) => [i, v]) : Object.entries(root as Record<string, unknown>)
  for (const [key, val] of entries) {
    if (key === 'data' && Array.isArray(val) && val.every(v => typeof v === 'number' || (v && typeof v === 'object' && 'x' in v))) continue // plotted points
    if (typeof val === 'string') {
      const next = toPrint(val)
      if (next !== val) {
        swaps.push({ obj: root as Record<string, unknown>, key, old: val })
        ;(root as Record<string | number, unknown>)[key] = next
      }
    } else if (val && typeof val === 'object') {
      swapColours(val, swaps, seen)
    }
  }
}

function siteIsDark(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.qhTheme !== 'light'
}

/**
 * Runs `fn` with every chart drawn in light-theme colours (only needed when
 * the site is in the dark theme), then restores them — even if `fn` throws.
 * withWatermarksDisabled() already does this; call it directly only for an
 * export that keeps the watermark (free PNG) or does not use that helper.
 */
export async function withPrintColors<T>(charts: Array<AnyChart | null | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const all = charts.filter((chart): chart is AnyChart => Boolean(chart))
  if (!siteIsDark() || all.length === 0) return await fn()
  const swaps: Swap[] = []
  const seen = new Set<unknown>()
  all.forEach(chart => {
    swapColours(chart.config.options, swaps, seen)
    swapColours(chart.config.data, swaps, seen)
    chart.update('none')
  })
  try {
    return await fn()
  } finally {
    for (let i = swaps.length - 1; i >= 0; i--) {
      const s = swaps[i]
      ;(s.obj as Record<string | number, unknown>)[s.key] = s.old
    }
    all.forEach(chart => chart.update('none'))
  }
}

/**
 * Prepares charts for a Pro export, runs `fn` (which reads each canvas via
 * toBase64Image()), then restores everything — even if `fn` throws:
 *   1. watermark off and its bottom strip padding removed (watermarked charts),
 *   2. every chart redrawn at EXPORT_CHART_WIDTH × 75% of its current height, at 2× pixel ratio,
 *   3. light-theme colours (withPrintColors), whatever theme the site is in.
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
    const h = heights.get(chart) ?? chart.height
    chart.resize(EXPORT_CHART_WIDTH, Math.max(EXPORT_MIN_HEIGHT, Math.round(h * EXPORT_HEIGHT_SCALE)))
  })

  try {
    // light-theme colours too, so labels are readable on white paper
    return await withPrintColors(all, fn)
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
