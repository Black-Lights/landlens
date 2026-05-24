# 01 — Architecture

## The Simple Version

LandLens is a website that shows a map of India. You click on land, you see details. Behind the scenes, three systems work together:

```
   ┌──────────────────┐
   │   YOUR BROWSER   │  ← You see the map here
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  LANDLENS WEB    │  ← Next.js app on Vercel
   │  (the website)   │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │    DATABASE      │  ← Supabase PostgreSQL + PostGIS
   │   (the records)  │     Stores all parcels, owners, boundaries
   └────────▲─────────┘
            │
   ┌────────┴─────────┐
   │   AI SERVICE     │  ← Separate Python service
   │ (the brain that  │     Runs only when needed to detect
   │  finds boundaries│     parcel boundaries from satellites
   │  using AI)       │
   └──────────────────┘
```

That's it. Three boxes. Each does one thing well.

## Why Three Separate Pieces?

### Why a separate database?

The database is the **source of truth**. Both the website and the AI service read from it and write to it. If we put data inside the app, we'd lose it every time we redeployed.

PostgreSQL with the PostGIS extension is the industry standard for storing maps. It can answer questions like "what parcel contains this point?" in milliseconds even with millions of records.

### Why a separate AI service?

Three reasons:

**1. Different tools.** The website is built with JavaScript/TypeScript. AI work needs Python with PyTorch, CUDA, and gigabytes of model weights. Mixing them would make both worse.

**2. Different costs.** The website runs on a free tier forever. The AI service needs GPUs that cost money per second. Keeping them separate means we only pay for AI compute when we use it.

**3. Different lifecycles.** The website ships updates weekly. The AI model is research work — months between major updates. Forcing them into one repo would slow both down.

### Why Next.js for the website?

- **One framework** for frontend and backend (no need to run two servers)
- **Free hosting** on Vercel
- **Built-in i18n** for multi-language support
- **Edge functions** make APIs fast worldwide
- **Big community** so plenty of help available

## The Data Flow

### When you load the homepage:

1. Browser asks Vercel for `land.trenlens.com`
2. Vercel sends back the Next.js app
3. App asks the database for India's state boundaries
4. Database returns vector tiles (compressed map data)
5. MapLibre renders the map
6. You see India

### When you click on a parcel:

1. Browser tells the app: "user clicked at 18.5204°N, 73.8567°E"
2. App asks the database: "what parcel is at this point?"
3. Database runs `ST_Contains()` and finds Khasra 123/4 in Khadki village
4. App fetches the full parcel record (owner, area, history)
5. The sidebar slides in with all the details

### When you click somewhere with no recorded parcel:

1. Browser → app → database: "what's here?"
2. Database: "nothing"
3. App asks the AI service: "can you detect a parcel here?"
4. AI service pulls satellite data + AlphaEarth embeddings
5. AI service runs SAM2 to generate a polygon
6. AI service saves the polygon to the database
7. App returns the new polygon to the browser
8. Sidebar shows: "AI-detected boundary · 78% confidence"

Next time anyone clicks the same area, step 1-2 returns the cached polygon instantly.

## Where Things Live

| Component | Lives at | Cost |
|---|---|---|
| Website code | Vercel | Free (Hobby tier) |
| Database | Supabase | Free (500 MB) → Pro ($25/mo) |
| Cache | Upstash Redis | Free (10k commands/day) |
| AI service | Modal or Replicate | ~$0.50 per 100 segmentations |
| Domain | `land.trenlens.com` via Cloudflare | Free (subdomain of existing) |
| Map tiles | MapTiler / OpenFreeMap | Free tier |

**Total monthly cost during MVP: ₹0** (everything is on free tiers).
**At 10,000 users/month: ~₹2,000-3,000** (Supabase Pro + occasional AI inference).

## Scaling Strategy

We're building for free tier today, but the architecture scales linearly:

1. **0-1,000 users:** Free tier everywhere
2. **1,000-100,000 users:** Upgrade Supabase to Pro
3. **100,000-1M users:** Add Redis caching layer, pre-compute popular tiles
4. **1M+ users:** Migrate database to Neon serverless or dedicated AWS RDS

The code doesn't change at any of these steps. Just config and infrastructure.

## What's Next

→ Read [Database Schema](./02-database-schema.md) to see what we actually store.
