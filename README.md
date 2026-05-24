<p align="center">
  <img src="public/brand/logo.svg" alt="LandLens" width="280"/>
</p>

<p align="center">
  <strong>See Every Inch of Land</strong><br/>
  A unified, modern map of India's land records.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-PolyForm%20NC%201.0.0-blue"/></a>
  <a href="https://land.trenlens.com"><img alt="Live" src="https://img.shields.io/badge/live-land.trenlens.com-2563EB"/></a>
  <a href="docs/README.md"><img alt="Docs" src="https://img.shields.io/badge/docs-read-success"/></a>
</p>

---

## What this is

India's land records are scattered across 28+ state portals. LandLens brings them into one elegant, mobile-first map. Click any plot — see who owns it, who owned it before, area, type, history. In your language.

## Status

Phase 1 — active development. Non-commercial open source under PolyForm Noncommercial 1.0.0.

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in Supabase + Upstash values
npx prisma generate
npx prisma migrate dev --name init
# Then in the Supabase SQL editor, run prisma/sql/post-init.sql
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/en`. Check `/api/health` to verify backing services.

## Documentation

All design decisions, architecture, schema, and roadmap live in [`docs/`](docs/README.md). Start there.

## Contributing

See [`docs/09-contributing.md`](docs/09-contributing.md). For security issues, see [SECURITY.md](SECURITY.md) — do not open a public issue.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Free for academic, research, and personal use. Commercial use requires a separate license — contact the maintainers.
