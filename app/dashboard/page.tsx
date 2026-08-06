'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSubscription } from '@/lib/useSubscription'
import { COLORS, getSharedStyles, usePersistedTheme, BRAND_GRADIENT, BRAND_GRADIENT_TEXT_COLOR } from '@/lib/theme'
import AuthStatus from '@/components/AuthStatus'

type Tool = 'spc' | 'pareto' | 'dpmo' | 'oee' | 'gage_rr' | 'stability' | 'aql'

interface SavedAnalysis {
  id: string
  tool: Tool
  name: string
  created_at: string
  updated_at: string
}

const TOOL_LABELS: Record<Tool, string> = {
  spc: 'SPC Engine',
  pareto: 'Pareto Chart',
  dpmo: 'DPMO & Sigma',
  oee: 'OEE Calculator',
  gage_rr: 'Gage R&R',
  stability: 'Stability Study',
  aql: 'AQL Sampling Plan',
}

const TOOL_ROUTES: Record<Tool, string> = {
  spc: '/spc',
  pareto: '/pareto',
  dpmo: '/dpmo',
  oee: '/oee',
  gage_rr: '/gage-rr',
  stability: '/stability',
  aql: '/aql',
}

export default function DashboardPage() {
  const router = useRouter()
  const [theme, setTheme] = usePersistedTheme()
  const c = COLORS[theme]
  const s = getSharedStyles(theme)
  const { isPro, loading: subLoading } = useSubscription()

  const [analyses, setAnalyses] = useState<SavedAnalysis[] | null>(null)
  const [error, setError] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const loadAnalyses = useCallback(async () => {
    const res = await fetch('/api/saved-analyses')
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to load saved projects.')
      return
    }
    setAnalyses(json.analyses)
    setError('')
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
      }
    })
  }, [router])

  useEffect(() => {
    if (!isPro) return
    fetch('/api/saved-analyses')
      .then(async res => ({ ok: res.ok, json: await res.json() }))
      .then(({ ok, json }) => {
        if (!ok) {
          setError(json.error ?? 'Failed to load saved projects.')
          return
        }
        setAnalyses(json.analyses)
        setError('')
      })
  }, [isPro])

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this project?')) return
    const res = await fetch(`/api/saved-analyses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAnalyses(prev => prev?.filter(a => a.id !== id) ?? null)
    } else {
      const json = await res.json()
      alert(json.error ?? 'Failed to delete.')
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return }
    const res = await fetch(`/api/saved-analyses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    if (res.ok) {
      const json = await res.json()
      setAnalyses(prev => prev?.map(a => (a.id === id ? { ...a, name: json.analysis.name } : a)) ?? null)
    } else {
      const json = await res.json()
      alert(json.error ?? 'Failed to rename.')
    }
    setRenamingId(null)
  }

  // ── TEMPORARY: test-only button, just to confirm list/delete/rename
  // work before the real "Save" button is wired into each tool.
  // Delete this function and its button once tools are wired up. ──
  async function handleAddTestProject() {
    const res = await fetch('/api/saved-analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'dpmo',
        name: `Test project — ${new Date().toLocaleString('en-US')}`,
        input_data: { test: true },
        results: { test: true },
      }),
    })
    if (res.ok) {
      loadAnalyses()
    } else {
      const json = await res.json()
      alert(json.error ?? 'Failed to save.')
    }
  }

  if (subLoading) {
    return <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  }

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}>σ</div>
            QualityTools
          </Link>
          <span style={s.separator}>/</span>
          <span style={s.breadcrumb}>Dashboard</span>
        </div>
        <div style={s.navRight}>
          <button style={s.themeBtn} onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <AuthStatus />
        </div>
      </nav>

      <div style={s.main}>
        {!isPro ? (
          <div style={{ ...s.card, textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Saved projects are a Pro feature
            </div>
            <div style={{ color: c.muted, fontSize: 14, marginBottom: 20 }}>
              Upgrade to Pro to save your analyses and come back to them anytime.
            </div>
            <Link
              href="/account"
              style={{
                background: BRAND_GRADIENT,
                color: BRAND_GRADIENT_TEXT_COLOR,
                fontWeight: 700,
                fontSize: 13,
                padding: '10px 24px',
                borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              Upgrade to Pro
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Saved Projects</div>
                <div style={{ color: c.muted, fontSize: 13 }}>
                  {analyses?.length ?? 0} / 50 saved projects
                </div>
              </div>
              {/* TEMPORARY — remove once real Save is wired into the tools */}
              <button style={s.exportBtn} onClick={handleAddTestProject}>
                + Add Test Project (temporary)
              </button>
            </div>

            {error && <div style={{ color: c.danger, fontSize: 13 }}>{error}</div>}

            {analyses === null ? (
              <div style={{ color: c.muted }}>Loading...</div>
            ) : analyses.length === 0 ? (
              <div style={{ ...s.card, textAlign: 'center', padding: 40, color: c.muted }}>
                No saved projects yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analyses.map(a => (
                  <div key={a.id} style={s.rowCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renamingId === a.id ? (
                          <input
                            style={{ ...s.input, marginBottom: 0 }}
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRename(a.id)
                              if (e.key === 'Escape') setRenamingId(null)
                            }}
                            onBlur={() => handleRename(a.id)}
                          />
                        ) : (
                          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.name}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
                          {TOOL_LABELS[a.tool]} · Last updated {new Date(a.updated_at).toLocaleDateString('en-US')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <Link href={TOOL_ROUTES[a.tool]} style={{ ...s.exportBtn, textDecoration: 'none' }}>
                          Open
                        </Link>
                        <button
                          style={s.exportBtn}
                          onClick={() => { setRenamingId(a.id); setRenameValue(a.name) }}
                        >
                          Rename
                        </button>
                        <button style={s.removeBtn} onClick={() => handleDelete(a.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
