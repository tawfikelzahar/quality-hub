# Quality Hub

SaaS platform of statistical quality control tools for quality engineers and manufacturing professionals.

## Live Tools

- **SPC Engine** (`/spc`) — Variable data (I-MR, X̄-R) and attribute data (p/np/c/u) control charts, capability analysis (Cp/Cpk/Pp/Ppk/Cpm), sigma level/Z-bench, Nelson Rule violations, Anderson-Darling normality test.
- **Pareto Chart** (`/pareto`) — Pareto analysis with CSV/Excel/PNG/PDF export.
- **DPMO & Sigma Calculator** (`/dpmo`) — Defects per million opportunities and sigma level (Acklam algorithm, 1.5σ shift).
- **AQL Sampling Plan Calculator** (`/aql`) — ISO 2859-1 / ANSI Z1.4 sampling plans.
- **Gage R&R** (`/gage-rr`) — AIAG Average & Range method (3 appraisers × 10 parts × 3 trials).
- **Stability Study** (`/stability`) — Stability/shelf-life analysis.

All tools support export to CSV/Excel/PNG/PDF and require sign-in (Google OAuth or email/password via Supabase).

## Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Auth & DB:** Supabase
- **Charts:** Chart.js (`chart.js/auto`)
- **Exports:** `xlsx`, `jspdf`
- **Deployment:** Vercel (auto-deploy on `git push` to `main`)
- **Payments:** Lemon Squeezy (planned — see `app/account/page.tsx` for the stubbed "Upgrade to Pro" extension point)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Supabase project credentials:
   ```bash
   cp .env.example .env.local
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Project Docs

- [`docs/PROJECT-CONTEXT.md`](docs/PROJECT-CONTEXT.md) — current state, architecture, what's built vs. planned.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — short log of key technical decisions and why they were made.

## Deployment

Pushes to `main` auto-deploy to Vercel. Make sure the same environment variables from `.env.example` are set in the Vercel project settings.
