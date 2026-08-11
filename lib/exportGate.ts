// ─────────────────────────────────────────────────────────────────────────
// Shared by every tool's export buttons. CSV/PNG exports require a free
// account (email capture); Excel/PDF exports require Pro. Kept as plain
// functions (not a hook) so they can be called directly inside onClick
// handlers without extra wiring.
// ─────────────────────────────────────────────────────────────────────────

export function goToLogin() {
  if (typeof window === 'undefined') return
  const next = encodeURIComponent(window.location.pathname)
  window.location.href = `/login?next=${next}`
}

export function goToPricing() {
  if (typeof window === 'undefined') return
  window.location.href = '/pricing'
}
