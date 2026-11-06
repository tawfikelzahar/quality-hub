import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isAdminSession } from '@/lib/admin.server'
import AdminDashboard from '@/components/AdminDashboard'

// /admin — the site owner's dashboard. Signed-out visitors are sent to the
// login page by middleware.ts; signed-in non-admins get a plain 404, so the
// page gives away nothing. The database checks the admin again on every call.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  if (!(await isAdminSession())) notFound()
  return <AdminDashboard />
}
