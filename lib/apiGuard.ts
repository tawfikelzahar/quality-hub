import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { SITE } from '@/lib/site'

// ─────────────────────────────────────────────────────────────────────────
// Light protection for the calculation APIs, called at the top of each POST:
//   1. Origin  — the request must come from a page of this site. Browsers
//      always send Origin on POST, so a missing or foreign one is refused.
//      (A script can fake this header; the rate limit below is what bounds it.)
//   2. Size    — refuse bodies above a limit before reading them.
//   3. Rate    — a sliding window per visitor IP and per API.
//
// The rate counter lives in the server's memory, so each running instance
// keeps its own count. That is enough to stop someone looping on the API;
// a shared limit across instances would need a store (Vercel Firewall rule,
// Redis or a Supabase table).
// ─────────────────────────────────────────────────────────────────────────

export interface GuardOptions {
  /** Name of the API, so each one has its own counter */
  bucket: string
  /** Largest accepted request body, in bytes */
  maxBytes: number
  /** Requests allowed per visitor per minute */
  perMinute: number
  /** Requests allowed per visitor per hour */
  perHour: number
}

export const CALC_LIMITS = { maxBytes: 512 * 1024, perMinute: 60, perHour: 600 }

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const MAX_KEYS = 10_000

const hits = new Map<string, number[]>()

function extraHosts(): Set<string> {
  const hosts = new Set<string>([SITE.domain, `www.${SITE.domain}`])
  try { hosts.add(new URL(SITE.url).host) } catch { /* ignore */ }
  return hosts
}
const ALLOWED_HOSTS = extraHosts()

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  let originHost: string
  try { originHost = new URL(origin).host } catch { return false }
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  return originHost === host || ALLOWED_HOSTS.has(originHost)
}

/** Records the hit and returns seconds to wait, or 0 when the request is allowed. */
function rateWait(key: string, perMinute: number, perHour: number): number {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter(t => now - t < HOUR)
  const lastMinute = list.filter(t => now - t < MINUTE)
  if (lastMinute.length >= perMinute) {
    hits.set(key, list)
    return Math.ceil((lastMinute[0] + MINUTE - now) / 1000)
  }
  if (list.length >= perHour) {
    hits.set(key, list)
    return Math.ceil((list[0] + HOUR - now) / 1000)
  }
  list.push(now)
  hits.set(key, list)
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] >= HOUR) hits.delete(k)
    }
    if (hits.size > MAX_KEYS) hits.clear()
  }
  return 0
}

/** Returns a response to send back when the request is refused, otherwise null. */
export function guardApi(req: NextRequest, opts: GuardOptions): NextResponse | null {
  if (!originAllowed(req)) {
    return NextResponse.json(
      { error: 'Requests are accepted from the Mizan Quality website only.', code: 'origin' },
      { status: 403 },
    )
  }
  const len = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(len) && len > opts.maxBytes) {
    return NextResponse.json(
      { error: 'The data is too large for one analysis.', code: 'size' },
      { status: 413 },
    )
  }
  const wait = rateWait(`${opts.bucket}:${clientIp(req)}`, opts.perMinute, opts.perHour)
  if (wait > 0) {
    return NextResponse.json(
      { error: 'Too many analyses in a short time. Please wait a little and try again.', code: 'rate' },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    )
  }
  return null
}
