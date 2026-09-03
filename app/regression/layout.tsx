import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Linear Regression Calculator Online — Fitted Line, ANOVA, Prediction Intervals',
  description:
    'Free online simple linear regression tool: fitted-line plot, ANOVA and coefficient diagnostics, residual plots, and prediction intervals.',
  alternates: { canonical: '/regression' },
}

export default function RegressionLayout({ children }: { children: React.ReactNode }) {
  return children
}
