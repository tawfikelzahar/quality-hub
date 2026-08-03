# Quality Hub — Project Context

Quick-reference for the current state of the project. Update this when a tool goes live, a major architecture decision changes, or a route is added. Keep it short — this is a map, not a spec.

## What this is

A single-tenant SaaS platform of statistical quality control tools, aimed at individual quality engineers and manufacturing professionals. Goal: real paying users, passive income. No teams/orgs, no RBAC — one user, one account, their own data.

## Stack

- Next.js (App Router) + TypeScript
- Supabase — auth (Google OAuth + email/password) + Postgres + Storage
- Vercel — hosting, auto-deploy on push to `main`
- Lemon Squeezy — payments (Stripe unavailable due to geographic restrictions)
- Chart.js (`chart.js/auto`, required instead of manual registration under Turbopack)
- `xlsx` + `jspdf` for exports

## Live tools (routes → source)

| Route | Component | API | Status |
|---|---|---|---|
| `/spc` | `components/SPCEngine.tsx` | `app/api/analyze/route.ts` | Live |
| `/pareto` | `components/ParetoChart.tsx` | — (client-side) | Live |
| `/dpmo` | `components/DPMOCalculator.tsx` | — (client-side) | Live |
| `/aql` | — (`lib/aql/`) | — | Live, Normal table verified; Tightened/Reduced unverified |
| `/gage-rr` | `components/GageRR.tsx` | `app/api/gage-rr/route.ts` | Live |
| `/stability` | `components/StabilityStudy.tsx` | `lib/stability/calc.ts` | Live |
| `/account` | — | — | Live — profile, password/avatar, "Upgrade to Pro" stub |
| `/login`, `/auth/callback` | — | — | Auth entry points |

All routes above except the public landing page (`/`) are gated by `middleware.ts` (`PROTECTED_PATHS`).

## Auth

- Google OAuth + email/password via Supabase, both feeding `user_metadata` (`full_name`, `avatar_url`) read by `components/AuthStatus.tsx`.
- Avatars: Supabase Storage `avatars` bucket (public), client-compressed via `lib/avatar.ts` (max 400px, JPEG 82%) before upload. RLS needs INSERT + UPDATE + **SELECT** (Storage runs a `RETURNING` after INSERT — no SELECT policy = 403).

## Design system

- `lib/theme.ts` — dark/light mode (`usePersistedTheme()`, localStorage key `qh-theme`), `getSharedStyles(theme)`, `COLORS` as single source of truth.
- Export pattern standardized across tools: CSV / Excel / PNG / PDF buttons, same as `ParetoChart.tsx`.
- UI strings in English, centralized per-tool (e.g. `lib/aql/messages.ts`) for future i18n.

## Known gaps / flagged risk

- **AQL Tightened/Reduced tables** (`lib/aql/tables.ts`, `lib/aql/calculator.ts`) are heuristic, not verified against the official ISO 2859-1 source. Do not present these as reliable accept/reject decisions until verified. The Normal table (`RESOLVED_NORMAL`) is fully verified.
- **Lemon Squeezy integration** — not built. `app/account/page.tsx` has a disabled "Upgrade to Pro" button as the extension point.

## Working agreements

- Tawfik has no coding background — every step needs exact copy-paste instructions, no assumed prior knowledge.
- Deliver complete working implementations in one pass, not iterative review cycles.
- Run `npx tsc --noEmit` and ESLint before delivering code.
- Commit workflow: `git add . && git commit -m "<message>" && git push origin main`.
- Git conflicts: `git pull origin main --no-rebase` → `git checkout --ours <file>` → commit/push.
- One git command per line — concatenating causes malformed commit messages.
