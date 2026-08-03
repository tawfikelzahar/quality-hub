# Decisions Log

Short entries only — one or two lines. Why we chose something, not how it works. Add a new entry at the top when a decision could otherwise be silently reversed or re-litigated later.

---

**Single-tenant only, no multi-tenancy/orgs/RBAC.**
Replaced an earlier over-engineered plan. One user = one account = their own data. Add complexity only when real demand shows up.

**Lemon Squeezy instead of Stripe.**
Stripe isn't available due to geographic restrictions. Lemon Squeezy chosen as the payment processor; integration point stubbed in `app/account/page.tsx` but not yet built.

**AQL Normal table is a precomputed lookup table, not a formula.**
Mathematical/heuristic approaches to the Ac/Re table produced wrong results in edge cases. Only reliable approach: extract raw values from a confirmed official Excel source and hardcode the full table (`RESOLVED_NORMAL`). Tightened/Reduced tables still use the old heuristic and are flagged unverified — do not trust for real accept/reject decisions until confirmed against ISO 2859-1.

**`import 'chart.js/auto'` instead of manual Chart.js registration.**
Required for compatibility with Turbopack.

**Supabase Storage `avatars` bucket needs a SELECT RLS policy, not just INSERT/UPDATE.**
Upload-only flows still 403 without SELECT, because Supabase Storage runs an internal `RETURNING` clause after INSERT.

**SPC Engine migrated from a standalone HTML file into a React component.**
`public/spc-tool.html` was the original prototype; logic now lives in `components/SPCEngine.tsx`, calling the existing `app/api/analyze/route.ts` unchanged. The HTML file is kept as a local backup, not served as the primary tool.
