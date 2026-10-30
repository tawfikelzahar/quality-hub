'use client'

import { usePersistedTheme } from '@/lib/theme'
import Nav from '@/components/Nav'
import ToolsDirectory from '@/components/ToolsDirectory'

// ─────────────────────────────────────────────────────────────────────────
// /tools — every tool on one page (the "Tools" link in the top bar of every
// page lands here). Same list, groups and search as the landing page's tools
// section (components/ToolsDirectory.tsx), so the two never drift apart.
// ─────────────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  const [theme, setTheme] = usePersistedTheme()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--qh-bg)', color: 'var(--qh-text)' }}>
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_tools" />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px) clamp(16px, 3vw, 24px) 64px' }}>
        <ToolsDirectory as="h1" where="tools" />
      </main>
    </div>
  )
}
