# 09 — Contributing

> How to help build LandLens. What kinds of contributions we're looking for, how to set up the project locally, and what the review process looks like.

## Before You Start

LandLens is licensed under [PolyForm Noncommercial 1.0.0](../LICENSE). That means:

- You can fork, modify, and run LandLens for personal, academic, research, or evaluation use.
- You cannot resell LandLens or anything built from it during Phase 1.
- Contributions you submit are accepted under the same license.

If you plan a substantial contribution, open an issue first so we can align on scope.

## What We Need Help With

In rough order of impact:

1. **State data adapters** — One scraper per state portal in `lib/scrapers/`. Each one filled in unlocks a region of the map for real users.
2. **Translations** — Phase 2 and Phase 3 language catalogs (Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati, Punjabi, Odia, Malayalam). Native-speaker review especially welcome.
3. **Cadastral terminology** — Glossary additions and corrections in [10-glossary.md](./10-glossary.md). Indian land terms vary by region; we'd rather over-document than under.
4. **AI segmentation** — Improvements to the separate [`landlens-segmentation`](https://github.com/yourname/landlens-segmentation) repo. Thesis-grade work welcome.
5. **Bug fixes** — Anything in [issues](https://github.com/yourname/landlens/issues) labeled `good-first-issue` or `bug`.
6. **Documentation** — These docs are part of the product. Plain-language clarifications, diagrams, examples are all valued.

## What We Don't Need

- **New UI frameworks.** We've picked Next.js + Tailwind + shadcn. Switching costs are not worth the marginal benefit.
- **Premature optimizations.** Profile first, optimize second.
- **Speculative AI features.** The AI service is anchored to the registry. Adding free-floating ML doesn't help.
- **License changes.** PolyForm NC 1.0.0 is the deliberate choice for Phase 1. See [Licensing](./14-licensing.md).

## Local Setup

### Prerequisites

- Node.js 20 or newer
- pnpm or npm
- Docker (for local Postgres + PostGIS)
- A Supabase account (free tier) — used for production-shape testing

### One-time setup

```bash
git clone https://github.com/yourname/landlens.git
cd landlens
npm install

# Spin up local Postgres with PostGIS
docker run --name landlens-db \
  -e POSTGRES_PASSWORD=local \
  -p 5432:5432 \
  -d postgis/postgis:16-3.4

# Enable extensions
docker exec -i landlens-db psql -U postgres <<SQL
CREATE EXTENSION postgis;
CREATE EXTENSION pg_trgm;
CREATE EXTENSION "uuid-ossp";
SQL

# Configure .env.local from the template
cp .env.example .env.local
# edit DATABASE_URL=postgresql://postgres:local@localhost:5432/postgres

# Apply schema
npx prisma migrate dev

# Seed admin boundaries + mock parcels
npx tsx scripts/ingest-admin-boundaries.ts
npx tsx scripts/generate-mock-parcels.ts
npx tsx scripts/seed-mock-owners.ts

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you should see India with mock parcels.

## Branching & Commits

- Branch off `main`. Name branches `feat/<short-description>`, `fix/<short-description>`, `docs/<short-description>`.
- Commit messages: imperative, ≤72 chars on the first line. Body wraps at 72.
- One logical change per PR. Bundle related changes; never sneak in drive-by refactors.

Example:

```
feat(scrapers): add Maharashtra MahaBhumi adapter

Pulls Khasra polygons from the MahaBhumi GIS portal for a given
village LGD code. Respects robots.txt and applies a 2-second delay
between requests. Cached responses live in Upstash with a 24-hour TTL.

Closes #42
```

## PR Requirements

Before opening a PR:

- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] `npm test` clean (unit tests where they exist)
- [ ] Manually tested at `localhost:3000` for the affected feature
- [ ] If touching API routes: added/updated the Zod schema and verified `/api/openapi.json` still validates
- [ ] If touching UI: tested in `en`, `hi`, `ur` (RTL); checked at 320px width
- [ ] If adding a dependency: justify in the PR description (LandLens prefers fewer deps)
- [ ] If touching the database: included the Prisma migration file

CI will run all of the above. PRs that fail CI are not reviewed until green.

## Code Style

Auto-formatted on save by Prettier. Linted by ESLint with the Next.js config. Don't fight the formatter.

A few human conventions on top:

- **No `any` in committed TypeScript.** If you need it, use `unknown` and narrow.
- **Zod for every API boundary.** Inputs and outputs. Types derive from schemas, never the other way around.
- **Server components by default.** Use `'use client'` only when you need state, effects, or browser APIs.
- **Small components.** If a component exceeds ~200 lines, split it.
- **Comments explain *why*, not *what*.** Well-named code already says what. See the global `CLAUDE.md` conventions.

## State Scraper Contribution Checklist

Adding a new state scraper is the highest-impact contribution. Follow this checklist:

- [ ] File lives at `lib/scrapers/<state-code>.ts`
- [ ] Implements the `StateScraper` interface from `lib/scrapers/base.ts`
- [ ] Honors `robots.txt`
- [ ] Minimum 2-second delay between requests
- [ ] One concurrent request per portal
- [ ] Sets `User-Agent: LandLens/0.1 (+https://land.trenlens.com)`
- [ ] Backoff on 429 / 5xx with jitter
- [ ] Writes `parcels.source_portal` for every inserted row
- [ ] Writes `parcels.raw_data` with the full original record
- [ ] Adds the portal to NOTICE.md under "State Government Bhulekh / Bhu-Naksha Portals"
- [ ] Has a dry-run mode that prints what would be written without inserting

The first one is in `lib/scrapers/base.ts` as a reference.

## Translation Contribution Checklist

- [ ] File lives at `messages/<locale>.json`
- [ ] Every key from `messages/en.json` is present
- [ ] Native-speaker reviewed (note the reviewer in the PR description)
- [ ] Cadastral terms (`khasra`, `khatauni`, etc.) use the locally accepted spelling, not a transliteration
- [ ] Tested at 1.3× text length to verify no truncation
- [ ] If the locale is RTL, RTL spot-check on `/`, `/parcel/<id>`, `/saved`

## Reporting Issues

Bug reports:

```
Title: [bug] One-line summary

What I did:
What I expected:
What happened instead:
Locale + browser + OS:
URL or steps to reproduce:
Screenshot or screen recording (if UI):
```

Feature requests:

```
Title: [feature] One-line summary

What problem does this solve?
Who benefits? (citizens / farmers / lawyers / banks / researchers / journalists)
What does the simplest version look like?
What are you not asking for? (to scope the request)
```

## Security Issues

Do not file security issues publicly. Email the maintainer directly. See `SECURITY.md` for the disclosure policy and our 32-day cure window (which aligns with the PolyForm NC 1.0.0 notice period).

## Code of Conduct

Be kind. Assume good faith. Don't punch down. We follow the [Contributor Covenant 2.1](https://www.contributor-covenant.org/). Violations are handled privately by the maintainer.

## What's Next

→ Read [Glossary](./10-glossary.md) to learn the cadastral terms you'll see throughout the codebase.
