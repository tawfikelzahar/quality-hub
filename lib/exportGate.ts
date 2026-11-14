// ─────────────────────────────────────────────────────────────────────────
// Shared by every tool's export buttons. CSV/PNG exports require a free
// account (email capture); Excel/PDF exports require Pro. Kept as plain
// functions (not a hook) so they can be called directly inside onClick
// handlers without extra wiring.
//
// Both functions also fire a GA4 event before redirecting, tagged with the
// tool name and the feature the visitor was trying to use. This is how we
// measure real purchase intent — someone hitting the Pro paywall on Gage R&R
// is a much stronger signal than a page view.
// ─────────────────────────────────────────────────────────────────────────

import { track } from '@/lib/analytics'
import { hereLocalized } from '@/lib/i18n/routing'
import { stashDraft } from '@/lib/draft'

type GateFeature = 'csv' | 'png' | 'excel' | 'pdf' | 'ai' | 'insight' | 'tool' | 'diagnostics'

function trackGateEvent(eventName: 'signup_wall_hit' | 'pro_wall_hit', tool: string, feature: GateFeature) {
  track(eventName, { tool_name: tool, feature })
}

export function goToLogin(tool: string, feature: GateFeature) {
  if (typeof window === 'undefined') return
  trackGateEvent('signup_wall_hit', tool, feature)
  stashDraft() // the visitor finds their analysis again after signing in (lib/draft.ts)
  const next = encodeURIComponent(window.location.pathname)
  window.location.href = hereLocalized(`/login?next=${next}`)
}

export function goToPricing(tool: string, feature: GateFeature) {
  if (typeof window === 'undefined') return
  trackGateEvent('pro_wall_hit', tool, feature)
  stashDraft()
  window.location.href = hereLocalized('/pricing')
}
