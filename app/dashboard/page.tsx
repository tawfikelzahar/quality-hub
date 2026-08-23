'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSubscription } from '@/lib/useSubscription'
import { COLORS, getSharedStyles, usePersistedTheme, BRAND_GRADIENT, BRAND_GRADIENT_TEXT_COLOR } from '@/lib/theme'
import Nav from '@/components/Nav'

type Tool = 'spc' | 'pareto' | 'dpmo' | 'oee' | 'gage_rr' | 'stability' | 'aql' | 'icmsf' | 'regression' | 'multiregression'

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
  icmsf: 'ICMSF Microbiological Sampling Plan',
  regression: 'Simple Linear Regression',
  multiregression: 'Multiple Linear Regression',
}

const TOOL_ROUTES: Record<Tool, string> = {
  spc: '/spc',
  pareto: '/pareto',
  dpmo: '/dpmo',
  oee: '/oee',
  gage_rr: '/gage-rr',
  stability: '/stability',
  aql: '/aql',
  icmsf: '/icmsf',
  regression: '/regression',
  multiregression: '/multiregression',
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

  if (subLoading) {
    return <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  }

  return (
    <div style={s.page}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_dashboard" showGetPro={false} />

      <div className="qh-main" style={s.main}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Saved Projects</div>
                <div style={{ color: c.muted, fontSize: 13 }}>
                  {analyses?.length ?? 0} / 50 saved projects
                </div>
              </div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
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
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        <Link href={`${TOOL_ROUTES[a.tool]}?id=${a.id}`} style={{ ...s.exportBtn, textDecoration: 'none' }}>
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
