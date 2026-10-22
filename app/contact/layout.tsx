import type { Metadata } from 'next'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    `Get in touch with ${SITE.name} — email, WhatsApp, or LinkedIn for questions about billing, accounts, or the statistical quality engineering tools.`,
  alternates: { canonical: '/contact' },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
