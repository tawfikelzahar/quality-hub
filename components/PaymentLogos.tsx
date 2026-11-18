'use client'

// Card network acceptance marks, required on the site by the Paymob
// contract (annex clause 3.2.2). Visa and Mastercard files come from the
// payment-icons package (MPL-2.0). Meeza is the official mark, placed on a
// white card of the same shape.
import { useLanguage } from '@/lib/i18n/context'

const LOGOS = [
  { src: '/payment/visa.svg', alt: 'Visa' },
  { src: '/payment/mastercard.svg', alt: 'Mastercard' },
  { src: '/payment/meeza.png', alt: 'Meeza' },
]

export default function PaymentLogos({ align = 'start' }: { align?: 'start' | 'center' }) {
  const { t } = useLanguage()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      <span style={{ fontSize: 12, color: 'var(--qh-muted)' }}>{t('pay_accepted')}</span>
      {LOGOS.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={l.src} src={l.src} alt={l.alt} width={38} height={24} style={{ display: 'block', height: 24, width: 'auto' }} />
      ))}
    </div>
  )
}
