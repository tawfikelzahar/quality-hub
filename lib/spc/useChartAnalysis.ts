'use client'

import { useEffect, useState } from 'react'
import type { VariableChartResult } from '@/lib/spc/calculator'
import { wireReviver } from '@/lib/spc/wire'

// ─────────────────────────────────────────────────────────────────────────
// Asks the server (/api/spc/chart) for an I-MR, X̄-R or X̄-S result. The
// calculator stays on the server; the page only sends the readings and
// draws what comes back. A result is shown only while it still belongs to
// the current data and limits, so a late reply never overwrites newer input.
// ─────────────────────────────────────────────────────────────────────────

export type ChartKind = 'imr' | 'xbar-r' | 'xbar-s'

export interface ChartLimits {
  lsl: number | null
  usl: number | null
  target: number | null
}

interface Done {
  data: number[][]
  limits: ChartLimits
  result: VariableChartResult | null
  /** why there is no result: 'rate' = too many requests, 'error' = anything else */
  reason: 'rate' | 'error' | null
}

export function useChartAnalysis(kind: ChartKind, data: number[][] | null, limits: ChartLimits) {
  const [done, setDone] = useState<Done | null>(null)

  useEffect(() => {
    if (!data) return
    const ctrl = new AbortController()
    fetch('/api/spc/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chart: kind, data, LSL: limits.lsl, USL: limits.usl, target: limits.target }),
      signal: ctrl.signal,
    })
      .then(async res => {
        if (!res.ok) {
          setDone({ data, limits, result: null, reason: res.status === 429 ? 'rate' : 'error' })
          return
        }
        const json = JSON.parse(await res.text(), wireReviver) as { result: VariableChartResult }
        setDone({ data, limits, result: json.result, reason: null })
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setDone({ data, limits, result: null, reason: 'error' })
      })
    return () => ctrl.abort()
  }, [kind, data, limits])

  const current = done && done.data === data && done.limits === limits ? done : null
  return {
    result: current?.result ?? null,
    pending: data !== null && current === null,
    /** false, or the reason the calculation did not come back */
    failed: current !== null && current.result === null ? (current.reason ?? 'error') : (false as const),
  }
}
