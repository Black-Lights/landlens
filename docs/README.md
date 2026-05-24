# LandLens Documentation

> *See Every Inch of Land*

Welcome to the LandLens documentation. This is your starting point — whether you're a developer joining the project, a researcher curious about the AI pipeline, or just trying to understand what we're building.

## What is LandLens?

LandLens is a unified, modern, mobile-friendly platform for exploring India's land records. Click any plot of land on a map, and instantly see who owns it, who owned it before, what kind of land it is, and how big it is.

Today this information is scattered across 28+ state portals, each with old interfaces and no maps. LandLens brings it all into one clean place.

## Who is this for?

- **Citizens** verifying land before buying
- **Farmers** checking their plot details
- **Lawyers** doing due diligence for clients
- **Banks** validating mortgage collateral
- **Researchers** studying land use and policy
- **Journalists** investigating land disputes

## How to read these docs

Read in order if you're new. Skip around if you know what you're looking for.

| # | Doc | What it covers |
|---|---|---|
| 01 | [Architecture](./01-architecture.md) | The big picture: how the pieces fit together |
| 02 | [Database Schema](./02-database-schema.md) | What we store and why |
| 03 | [Data Sources](./03-data-sources.md) | Where land data comes from (government + open + AI) |
| 04 | [Boundary Segmentation](./04-boundary-segmentation.md) | How we draw the polygons on the map |
| 05 | [Cadastral Anchoring](./05-cadastral-anchoring.md) | How registry data makes the AI accurate |
| 06 | [Internationalization](./06-internationalization.md) | Multi-language support (English, Hindi, Urdu, ...) |
| 07 | [Deployment](./07-deployment.md) | How to ship LandLens to production |
| 08 | [AI Service](./08-ai-service.md) | The separate Python service (thesis territory) |
| 09 | [Contributing](./09-contributing.md) | How to help build this |
| 10 | [Glossary](./10-glossary.md) | Cadastral terms in plain English |
| 11 | [AI-First Architecture](./11-ai-first-architecture.md) | How AI agents operate LandLens |
| 12 | [MCP Server](./12-mcp-server.md) | The Model Context Protocol server |
| 13 | [Admin Assistant](./13-admin-assistant.md) | In-app BYOK chat for admins |
| 14 | [Licensing & Commercial](./14-licensing.md) | PolyForm now → commercial later |
| 15 | [Enterprise Tier](./15-enterprise-tier.md) | The paid offering, when it ships |

## Two repositories

LandLens is built as two separate projects that talk to each other:

```
landlens/                    ← This repo. The website.
landlens-segmentation/       ← Separate repo. The AI brain.
```

The website works on its own with real cadastral data + mock data. The AI service is plugged in later to fill gaps. See [Architecture](./01-architecture.md) for why.

## Quick links

- **Live site:** https://land.trenlens.com *(coming soon)*
- **Main repo:** github.com/yourname/landlens
- **AI repo:** github.com/yourname/landlens-segmentation
- **Project prompt:** `../CLAUDE_CODE_PROMPT.md`
