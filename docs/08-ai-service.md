# 08 — The AI Service

> A separate Python project that handles all the smart parcel-detection work. The website talks to it via HTTP when needed.

## Why Separate?

The LandLens website is a TypeScript/Next.js app. AI work needs Python, PyTorch, GPU access, and gigabytes of model weights. Mixing them would make both messy.

So we built two projects:

| Repo | Language | Purpose | Where it runs |
|---|---|---|---|
| `landlens` | TypeScript | The website | Vercel (free) |
| `landlens-segmentation` | Python | The AI brain | Modal (per-second GPU) |

They talk over HTTP. Either can be updated without breaking the other.

## What the AI Service Does

One job: **given a location, return a parcel polygon.**

```
INPUT:  latitude, longitude, [optional: registry hints]
OUTPUT: polygon (GeoJSON) + confidence score + metadata
```

That's it. Everything else (storing it, showing it, search) is the website's job.

## What's Inside

```
landlens-segmentation/
├── pyproject.toml
├── README.md
├── src/
│   ├── earth_engine.py        # Pull AlphaEarth + Sentinel-2 from GEE
│   ├── sam2_inference.py      # Run SAM2 with embeddings
│   ├── registry_anchor.py     # Apply cadastral constraints (see doc 05)
│   ├── vectorize.py           # Convert raster mask → polygon
│   ├── snap_to_osm.py         # Align edges to known roads
│   ├── cache.py               # Save results to PostGIS
│   └── eval/                  # Accuracy benchmarks on FOTW dataset
├── api.py                     # FastAPI HTTP service
├── batch/                     # Pre-compute jobs (nightly)
├── notebooks/                 # Thesis experiments
└── Dockerfile                 # GPU-enabled container
```

## The API

A single HTTP endpoint:

```http
POST /segment
Content-Type: application/json

{
  "lat": 18.5204,
  "lng": 73.8567,
  "registry_hints": {
    "expected_plot_count": 5,
    "expected_areas_sqm": [2024, 1200, 1500, 800, 950],
    "village_lgd_code": "521205"
  }
}
```

Response:

```json
{
  "polygons": [
    {
      "khasra_no": "123/4",
      "geometry": { "type": "Polygon", "coordinates": [[...]] },
      "area_sqm": 2024,
      "confidence": 0.87,
      "source": "ai_with_constraints",
      "model_version": "sam2-hiera-large-v1.2",
      "alphaearth_year": 2025
    }
  ],
  "processing_time_ms": 3421
}
```

## Three Operation Modes

### 1. On-demand (real-time)

The website calls when a user clicks an unmapped area:

```
User clicks → Web app → AI service → SAM2 inference (3-5 seconds) → polygon back
```

Used sparingly because GPU time costs money. Result is cached forever in PostGIS.

### 2. Batch pre-compute (overnight)

A scheduled job processes whole districts in advance:

```
Cron at 2am → Fetch 100 unprocessed villages → Batch SAM2 → Save 5,000 polygons
```

Far cheaper per polygon than on-demand. Used to gradually fill India's coverage gaps.

### 3. Research mode (your thesis)

The same codebase runs experiments on benchmark datasets:

```python
# Evaluate on Fields of The World - India subset
python -m landlens_segmentation.eval --dataset fotw_india --model sam2_with_alphaearth
```

This is what publishes papers.

## Deployment Options

### Option A: Modal (recommended)

Modal is serverless GPU. You pay per second of inference.

- **Pros:** Auto-scales to zero (no bills when idle), simple deploy, GPU on demand
- **Cons:** Cold start adds ~5 seconds to first request
- **Cost:** ~$0.50 per 100 segmentations on A10G GPU

```python
# modal_deploy.py
import modal

stub = modal.Stub("landlens-segmentation")
gpu_image = modal.Image.debian_slim().pip_install([
    "torch", "segment-anything-2", "earthengine-api", 
    "rasterio", "shapely", "fastapi", "uvicorn"
])

@stub.function(gpu="A10G", image=gpu_image, timeout=60)
def segment(lat, lng, hints):
    # ... pipeline here ...
    return polygons
```

### Option B: Replicate

Same idea, slightly different DX. Good for sharing your AI as a public API for research.

### Option C: Self-hosted on Lambda Labs or RunPod

Cheaper for heavy use. More devops overhead.

### Option D: Skip GPU for budget version

K-means clustering on AlphaEarth embeddings runs on CPU. Accuracy is lower but it's free. Good fallback when GPU credits run out.

## How the Website Uses This

The Next.js app has this logic in `lib/segmentation/client.ts`:

```typescript
async function getParcelAt(lat: number, lng: number): Promise<Parcel> {
  // 1. Check cache first
  const cached = await db.parcels.findByPoint(lat, lng);
  if (cached) return cached;
  
  // 2. Get any registry hints
  const hints = await db.getRegistryHintsForArea(lat, lng);
  
  // 3. Call AI service
  const response = await fetch(`${SEGMENTATION_SERVICE_URL}/segment`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({ lat, lng, registry_hints: hints }),
  });
  
  if (!response.ok) {
    // Graceful degradation: return null, UI shows "Boundary not available"
    return null;
  }
  
  const result = await response.json();
  
  // 4. Save to DB so next user gets cached
  const parcel = await db.parcels.create({
    geom: result.polygons[0].geometry,
    confidence: result.polygons[0].confidence,
    boundary_source: result.polygons[0].source,
    ai_model_version: result.polygons[0].model_version,
  });
  
  return parcel;
}
```

Key point: if the AI service is down, the website **doesn't crash**. It just shows "Boundary not yet available — check back later" for unmapped areas. The rest of the site works fine.

## Development Workflow

### Phase 1: Website without AI (months 1-3)

- Build the website with real cadastral data + mock parcels
- Launch publicly at `land.trenlens.com`
- AI service env var is empty → website skips AI tiers
- Users see: official polygons where available, "boundary not available" elsewhere
- This already provides real value

### Phase 2: AI prototyping in parallel (months 2-6)

- Build `landlens-segmentation` in a separate repo
- Run experiments on Google Colab with free GPU
- Evaluate against Fields of The World benchmarks
- Write thesis chapters as you go
- Don't connect to the live website yet

### Phase 3: Quiet integration (month 6-7)

- Deploy AI service to Modal
- Set env var on website
- Enable for one test district (e.g., Pune Rural)
- Monitor for issues
- Gradually expand state by state

### Phase 4: Open science (post-thesis)

- Publish thesis paper
- Open-source `landlens-segmentation` under MIT
- Other researchers can use it for their own work
- LandLens becomes the reference implementation

## Why This Architecture Wins

1. **Website launches fast** (don't wait for AI to be ready)
2. **Website never breaks** when AI changes
3. **AI is reusable research output** (publish independently)
4. **Costs scale only when used** (no idle GPU bills)
5. **Two repos = clearer thinking** (web concerns vs ML concerns separate)
6. **Thesis stays clean** (academic work isn't entangled with product code)

## What's Next

→ Read [Boundary Segmentation](./04-boundary-segmentation.md) for the actual ML pipeline.
→ Read [Cadastral Anchoring](./05-cadastral-anchoring.md) for how registry data improves accuracy.
