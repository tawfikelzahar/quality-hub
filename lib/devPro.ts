// ─────────────────────────────────────────────────────────────────────────
// Local test switch: treat the current visitor as Pro while developing, so
// Pro screens and exports can be checked without signing in.
//
//   NEXT_PUBLIC_QH_DEV_PRO=1 npx next dev
//
// It only works under `next dev` (NODE_ENV === 'development'). Every build
// that Vercel deploys, preview or production, runs with NODE_ENV ===
// 'production', so there this constant is false and the switch does nothing.
// Never set NEXT_PUBLIC_QH_DEV_PRO in Vercel.
// ─────────────────────────────────────────────────────────────────────────

export const DEV_PRO = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_QH_DEV_PRO === '1'
