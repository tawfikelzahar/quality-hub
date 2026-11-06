'use client'

import { useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { isProRow } from '@/lib/plan'

// ─────────────────────────────────────────────────────────────────────────
// Who is signed in and on which plan — read ONCE per page load and shared by
// every component (nav, Get Pro buttons, the tool, Save, the phone menu,
// report branding).
//
// Before this, each component asked Supabase on its own and asked again when
// the auth listener reported the initial session, so one tool page sent
// about 13 × (auth/v1/user + profiles) requests. Now: one getUser and, when
// signed in, one profiles read. It is read again only when the signed-in
// user actually changes (sign-in, sign-out, another account) or when
// refreshAuthState() is called.
//
// This only decides what the page SHOWS. Pro features are still verified on
// the server for every request (lib/apiGuard.ts and the Pro routes).
// ─────────────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'free' | 'pro'

export interface AuthState {
  /** true until the first read has finished */
  loading: boolean
  user: User | null
  status: SubscriptionStatus
  /** Site owner (supabase/sql/010_admin_dashboard.sql). Only shows the Admin link; /admin checks again on the server. */
  isAdmin: boolean
}

const INITIAL: AuthState = { loading: true, user: null, status: 'free', isAdmin: false }

let state: AuthState = INITIAL
let started = false
let inflight: Promise<AuthState> | null = null
const listeners = new Set<() => void>()

function set(next: AuthState) {
  state = next
  listeners.forEach(l => l())
}

async function read(): Promise<AuthState> {
  const supabase = createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { loading: false, user: null, status: 'free', isAdmin: false }
    const [profile, admin] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.rpc('is_admin'),
    ])
    // No profile row, a failed read or a passed end date → 'free' (locked by default is the safe side)
    const status = !profile.error && isProRow(profile.data) ? 'pro' : 'free'
    return { loading: false, user, status, isAdmin: !admin.error && admin.data === true }
  } catch {
    return { loading: false, user: null, status: 'free', isAdmin: false }
  }
}

/** Reads the state again (one getUser + one profiles), shared by all callers in flight. */
export function refreshAuthState(): Promise<AuthState> {
  if (!inflight) {
    inflight = read().then(s => { set(s); return s }).finally(() => { inflight = null })
  }
  return inflight
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  refreshAuthState()
  // Only a real change of account matters. INITIAL_SESSION (fired right after
  // subscribing) and TOKEN_REFRESHED keep the same user, so they are ignored.
  createClient().auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return
    const id = session?.user?.id ?? null
    if (event === 'USER_UPDATED' || id !== (state.user?.id ?? null)) refreshAuthState()
  })
}

function subscribe(cb: () => void) {
  start()
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

const getSnapshot = () => state
const getServerSnapshot = () => INITIAL

/** The shared auth state (re-renders when it changes). */
export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** The current state once the first read has finished (for code outside React). */
export function authStateReady(): Promise<AuthState> {
  start()
  return state.loading ? (inflight ?? refreshAuthState()) : Promise.resolve(state)
}

/** Calls `cb` whenever the signed-in user or plan changes, including when the first read finishes with someone signed in. */
export function onAuthStateChanged(cb: (s: AuthState) => void): () => void {
  let last = `${state.user?.id ?? ''}|${state.status}`
  return subscribe(() => {
    const key = `${state.user?.id ?? ''}|${state.status}`
    if (state.loading || key === last) return
    last = key
    cb(state)
  })
}
