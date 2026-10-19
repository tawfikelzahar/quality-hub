// ─────────────────────────────────────────────────────────────────────────
// Shared Chart.js watermark plugin.
//
// Paints a faint diagonal tiled "qualityhub.tools" pattern across the plot
// area plus a solid brand strip along the very bottom of the canvas. Both
// are drawn INTO the canvas pixels (not an HTML overlay), so they survive
// right-click → Save Image, screenshots, and the free PNG export — there is
// no clean crop that removes them without also cutting into the chart.
//
// The strip lives in extra bottom padding reserved through
// `options.layout.padding.bottom` (see WATERMARK_STRIP_HEIGHT), so it sits
// below the x-axis labels/title instead of covering them.
//
// Pro PDF/Excel exports must NOT carry the watermark: the caller sets
// `options.plugins.watermark.enabled = false` and the reserved padding to 0,
// calls chart.update('none'), reads chart.toBase64Image(), then restores both.
// ─────────────────────────────────────────────────────────────────────────

import type { Chart, ChartType, Plugin } from 'chart.js'

const WATERMARK_TEXT = 'qualityhub.tools'

/** Height in px of the solid strip; also the bottom padding to reserve. */
export const WATERMARK_STRIP_HEIGHT = 22

export type WatermarkDensity = 'normal' | 'light'

export interface WatermarkOptions {
  /** 'normal' for line/control charts, 'light' for dense histogram/step charts. */
  density?: WatermarkDensity
  /** Set to false to suppress drawing (used just before a Pro export). */
  enabled?: boolean
}

// Teach Chart.js's types about `options.plugins.watermark`, so page-level
// inline options objects type-check without casts.
declare module 'chart.js' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    watermark?: WatermarkOptions
  }
}

// Size scales with the canvas width so the pattern stays clearly readable on
// wide desktop charts (a fixed 13px was too faint at 1200px+), while small
// phone charts keep the original compact size.
const DENSITY_CONFIG: Record<WatermarkDensity, { opacity: number; minFont: number; maxFont: number }> = {
  normal: { opacity: 0.17, minFont: 13, maxFont: 26 },
  light: { opacity: 0.11, minFont: 12, maxFont: 22 },
}

export const watermarkPlugin: Plugin = {
  id: 'watermark',
  afterDraw(chart: Chart, _args: unknown, opts: WatermarkOptions) {
    if (opts?.enabled === false) return

    const { ctx, chartArea, width, height } = chart
    if (!chartArea) return

    const cfg = DENSITY_CONFIG[opts?.density ?? 'normal']
    const { left, right, top, bottom } = chartArea

    // 1) Diagonal tiled text, clipped to the plot area
    ctx.save()
    ctx.beginPath()
    ctx.rect(left, top, right - left, bottom - top)
    ctx.clip()

    const fontSize = Math.round(Math.min(cfg.maxFont, Math.max(cfg.minFont, width / 45)))
    const spacing = fontSize * 11

    ctx.globalAlpha = cfg.opacity
    ctx.fillStyle = '#0e7474'
    ctx.font = `700 ${fontSize}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const reach = Math.hypot(right - left, bottom - top)
    const steps = Math.ceil(reach / spacing) + 1

    ctx.translate((left + right) / 2, (top + bottom) / 2)
    ctx.rotate(-Math.PI / 8)

    for (let row = -steps; row <= steps; row++) {
      for (let col = -steps; col <= steps; col++) {
        const x = col * spacing + (row % 2 === 0 ? 0 : spacing / 2)
        const y = row * (spacing / 1.6)
        ctx.fillText(WATERMARK_TEXT, x, y)
      }
    }
    ctx.restore()

    // 2) Solid brand strip along the bottom edge of the canvas
    ctx.save()
    ctx.globalAlpha = 1
    ctx.fillStyle = '#0e7474'
    ctx.fillRect(0, height - WATERMARK_STRIP_HEIGHT, width, WATERMARK_STRIP_HEIGHT)
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 11px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(WATERMARK_TEXT, width / 2, height - WATERMARK_STRIP_HEIGHT / 2 + 1)
    ctx.restore()
  },
}
