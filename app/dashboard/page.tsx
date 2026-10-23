'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useSubscription } from '@/lib/useSubscription'
import { usePersistedTheme } from '@/lib/theme'
import { useLanguage } from '@/lib/i18n/context'
import Nav from '@/components/Nav'
import AccountStyles from '@/components/AccountStyles'
import { SavedProjectsList, SavedProjectsLocked, SAVED_LIMIT } from '@/components/SavedProjects'

// Saved projects on their own page (also reachable from the account page).
// Free accounts see the feature with a faded example and a way to Pro.
export default function DashboardPage() {
  const router = useRouter()
  const [theme, setTheme] = usePersistedTheme()
  const { t } = useLanguage()
  const { isPro, loading } = useSubscription()
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
    })
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--qh-bg)', color: 'var(--qh-text)' }}>
      <AccountStyles />
      <Nav theme={theme} setTheme={setTheme} breadcrumbKey="bc_dashboard" />
      <main className="ac-wrap" style={{ maxWidth: 860 }}>
        {loading ? (
          <div className="ac-muted" style={{ padding: 40 }}>{t('acc_loading')}</div>
        ) : (
          <section className={`ac-card${isPro ? '' : ' ac-card-gold'}`} aria-labelledby="dash-h">
            <div className="ac-card-top">
              <div>
                <div className="ac-title-row">
                  <h2 id="dash-h" style={{ fontSize: 20 }}>{t('acc_saved')}</h2>
                  {!isPro && <span className="ac-pill ac-pill-pro">PRO</span>}
                </div>
                {isPro && count !== null && (
                  <div className="ac-sub">{t('acc_saved_count').replace('{n}', String(count)).replace('50', String(SAVED_LIMIT))}</div>
                )}
              </div>
            </div>
            {isPro ? <SavedProjectsList onCount={setCount} /> : <SavedProjectsLocked />}
          </section>
        )}
      </main>
    </div>
  )
}
