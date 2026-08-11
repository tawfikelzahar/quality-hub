import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Quality Hub is built by Tawfik Elzahar, a quality engineering professional with 10+ years in manufacturing and continuous improvement. Statistical tools built to ISO, AIAG, and ICH standards.',
  alternates: { canonical: '/about' },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
