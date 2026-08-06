# Ad Studio — AI Marketing Operating System

A SaaS that automates the marketing workflow end-to-end:
research → ideas → content → images/video → approval → publishing → analytics.

**Status: core pipeline live.** The morning brief works today: one click pulls
real trends (Google Trends + marketing RSS), generates content ideas, drafts
platform posts, and queues them for approve/reject on the dashboard.
Auth/organizations are parked until the product core is done
(design + migration preserved in `docs/` and `supabase/migrations/`).

## Run it

Zero configuration — no API keys, no database setup:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 → click **Generate today's brief**.

- **AI**: runs on a mock provider by default (offline, free). Real adapters
  plug into `lib/ai/registry.ts` behind the same `AIProvider` interface —
  set `AI_PROVIDER` in `.env.local` once one is added.
- **Data**: local SQLite at `./data/ad-studio.db`, created automatically.
  Every AI request is logged (`ai_request_logs`: tokens, latency, cost).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · SQLite
(better-sqlite3, swapping to Supabase Postgres later) · React Hook Form + Zod
· TanStack Query.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, no emit |

## How the pipeline works

`runMorningBrief()` (lib/services/brief.service.ts) is idempotent per day:

1. **Research** — fetch RSS sources (Google Trends US, Marketing Dive, Social
   Media Today); each source degrades independently, with bundled sample
   trends as a fully-offline fallback.
2. **Ideas** — trends → `AIProvider` → validated JSON (Zod) → stored ideas.
3. **Posts** — top ideas → Instagram + LinkedIn captions → pending drafts.
4. **Review** — dashboard shows everything; approve/reject per post.

## Architecture rules (short version)

Presentation → Actions → Services → Repositories → Database. Components hold
no business logic; every query lives in a repository; server actions are
validate → delegate; AI SDKs are only imported inside `lib/ai`; files stay
under 300 lines. Details in [docs/](docs/).
