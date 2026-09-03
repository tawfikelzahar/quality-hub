import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Multiple Regression Calculator Online — VIF, ANOVA, Prediction Intervals',
  description:
    'Free online multiple regression tool: two or more predictors, VIF collinearity checks, ANOVA and coefficient diagnostics, and prediction intervals.',
  alternates: { canonical: '/multiregression' },
}

export default function MultiregressionLayout({ children }: { children: React.ReactNode }) {
  return children
}
