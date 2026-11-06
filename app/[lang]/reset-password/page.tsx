import type { Metadata } from 'next'
import ResetPasswordClient from './ResetPasswordClient'

// Reached only from the link in a password-reset email (via /auth/callback),
// so it is kept out of search results.
export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <ResetPasswordClient />
}
