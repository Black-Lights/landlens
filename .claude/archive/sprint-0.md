## Sprint 0 — Documentation & Foundations (completed 2026-05-24)

### What was built
- LICENSE — PolyForm Noncommercial 1.0.0 with LandLens notice
- NOTICE.md — third-party attributions (OSM, Bhuvan/NRSC, Copernicus, AlphaEarth, MapTiler, Esri World Imagery, OpenTopoMap, Inter, Noto fonts, all major npm dependencies)
- docs/02-database-schema.md, 03-data-sources.md, 04-boundary-segmentation.md, 06-internationalization.md, 07-deployment.md, 09-contributing.md, 12-mcp-server.md, 13-admin-assistant.md, 15-enterprise-tier.md
- Basemap providers section added to CLAUDE_CODE_PROMPT.md (section 2) and docs/03-data-sources.md, with explicit reasoning for excluding Google Maps

### Key decisions locked in
- License: PolyForm Noncommercial 1.0.0 (single-license for Phase 1, dual-license commercial planned for Phase 2)
- Two-repo architecture: `landlens/` (this repo) + `landlens-segmentation/` (separate, Python, future)
- Stack: Next.js 14 App Router + TypeScript + Tailwind + Supabase (PostGIS) + Prisma + Upstash Redis + MapLibre GL JS
- Basemaps: MapTiler (streets, default), Esri World Imagery (satellite), OpenTopoMap (terrain), Bhuvan WMS (optional). Google Maps explicitly excluded (pricing tiers don't fit a pan-India consumer product, licensing forbids vector-overlay use cases, Esri+Bhuvan cover India well).
- i18n at launch: English (default), Hindi, Urdu (RTL)
- Domain: `land.trenlens.com` via Cloudflare CNAME → Vercel (DNS-only, not proxied — Vercel terminates TLS)
- AI-first patterns required from Sprint 1: Zod schemas, /api/openapi.json, public/llms.txt, structured errors, idempotency keys

### What was NOT built yet (don't redo)
- Next.js project itself (no package.json, no app/ folder)
- Database (schema designed in docs but no migrations run, no Supabase project linked)
- No code files of any kind — only docs and license

### Files that exist
- /LICENSE
- /NOTICE.md
- /CLAUDE_CODE_PROMPT.md
- /docs/README.md, 01..15 markdown files
- /.claude/SESSION_LOG.md (this file)
- /.claude/CLAUDE.md (project instructions for future sessions)
- /.claude/settings.json (pre-existing)

### Sprint 0 addendum (2026-05-24)
- Added GPS "Locate me" feature spec across CLAUDE_CODE_PROMPT.md (Core UI Elements control + new `/api/parcels/nearby` route + Mobile-First primary-CTA note + DoD item + §13 privacy bullet on GPS non-persistence), docs/02-database-schema.md (new "Common Spatial Queries" subsection with the `ST_DWithin` radius pattern using geography casts), docs/03-data-sources.md (new "User Location (GPS)" data source section, in-memory only, DPDP-aligned), docs/06-internationalization.md (new "Location Feature Copy" subsection with `locate.*` keys in en/hi/ur for launch).

### Next up
- Sprint 1 — scaffold Next.js, Tailwind, Supabase, Prisma. Set up AI-friendly foundations (Zod, OpenAPI, llms.txt, structured errors) from the start. Deploy empty site to `land.trenlens.com`.
