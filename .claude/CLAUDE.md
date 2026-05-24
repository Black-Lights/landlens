# Project Instructions for Claude Code

## What this project is

**LandLens** — a unified pan-India cadastral platform. Users see a map of India, click any plot of land, and see who owns it, who owned it before, area, type, history. Solves the problem of 28+ fragmented state land record portals.

**Tagline:** *See Every Inch of Land*

**Status:** Phase 1 — non-commercial open source (PolyForm Noncommercial 1.0.0). Academic/thesis-aligned. Commercial dual-license planned for Phase 2.

## Two-repo architecture

This is `landlens/` — the **website**. Next.js + TypeScript. Ships first.

A separate repo `landlens-segmentation/` (Python + FastAPI + PyTorch) handles AI parcel boundary detection using Google's AlphaEarth Foundations + SAM2. Built in parallel, plugged in later via `SEGMENTATION_SERVICE_URL` env var. The website degrades gracefully when it's absent. **Do not build segmentation code in this repo.**

## Locked stack (do not propose alternatives without asking)

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Map:** MapLibre GL JS + react-map-gl (NOT Google Maps — see basemap providers doc)
- **DB:** Supabase (PostgreSQL 15 + PostGIS 3.4 + pg_trgm + pgsodium)
- **ORM:** Prisma
- **Cache:** Upstash Redis
- **Auth:** Supabase Auth
- **i18n:** next-intl (English default, Hindi + Urdu RTL at launch)
- **Hosting:** Vercel (frontend) + Supabase (DB) + Cloudflare DNS for `land.trenlens.com`
- **AI providers (BYOK admin assistant):** Vercel AI SDK abstracts Anthropic, OpenAI, Google, Mistral

## Locked constraints

- **License:** PolyForm Noncommercial 1.0.0 — single license, Phase 1 only
- **Domain:** `land.trenlens.com` via Cloudflare CNAME (DNS-only, Vercel handles TLS)
- **Languages at launch:** English (default), Hindi, Urdu (RTL via `dir="rtl"` + Tailwind `rtl:` utilities)
- **Privacy:** User GPS coordinates are in-memory only, never persisted. DPDP Act 2023 aligned.
- **AI-first patterns (mandatory from Sprint 1):** Zod schemas on every API route, structured errors `{error: {code, message, suggested_action, docs_url}}`, `Idempotency-Key` header support on mutations, auto-generated OpenAPI at `/api/openapi.json`, `public/llms.txt`

## Read these first, in this order:

1. `.claude/SESSION_LOG.md` — what's already been done across past sessions. **Read this before doing ANYTHING else.** Do not redo completed work.
2. `CLAUDE_CODE_PROMPT.md` — the full project spec
3. `docs/README.md` — the documentation index, then read the docs relevant to the current sprint

## Working rules

- **Update `SESSION_LOG.md` at the end of every session.** Append a new section under the current sprint heading describing what you built, decisions made, and what's not yet done. Never delete past entries.
- Match the style of existing docs (plain-language opener → tables → "What's Next" footer).
- Stay within scope of the current sprint. If something seems out of scope, note it in the session log under "Deferred to later sprint" instead of building it.
- When unsure about a design choice, check the prompt and existing docs first. Ask the user only if it's not specified anywhere.
- All file paths in commits/comments are relative to repo root.
- Never commit secrets. Use `.env.example` for documentation, `.env.local` for real values (gitignored).

## Git discipline

- One commit per meaningful unit of work, not one giant commit at the end
- Commit message format: `sprint-N: <what>` (e.g., `sprint-1: scaffold Next.js with TypeScript and Tailwind`)

## When session ends

- Update `SESSION_LOG.md` with everything completed
- When updating SESSION_LOG.md, ONLY append new sections at the bottom. NEVER edit, rewrite, or delete existing sprint sections.
- Note any partial work or open questions
- Suggest the prompt for the next session if work spans sprints