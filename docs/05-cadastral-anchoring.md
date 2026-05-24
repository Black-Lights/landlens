# 05 — Cadastral Anchoring (Making AI Accurate Using Registry Data)

## The Problem in Plain English

Imagine two rice paddies, side by side. Ram owns the left one, Shyam owns the right one. They grow the same rice, harvested at the same time. There's a tiny mud ridge between them that you can barely see from space.

To a satellite — and to our AI model — these two paddies **look identical**. The AI sees one continuous green rectangle and says "this is one field."

But legally, this is **two parcels** with two different owners. The cadastral registry knows this. The AI doesn't.

**This is the core problem of AI cadastral mapping.** Computer vision sees what land looks like. Cadastre records what land legally is. They are different things, and we need both.

## The Solution

We make the AI **listen to the registry** before drawing its boundaries. The registry contains information the AI can't see from satellites:

- "This area has exactly 47 plots"
- "Khasra 123 should be 0.5 acres"
- "Khasra 124 should be 0.7 acres"
- "Plot 123 is north of plot 124"

When the AI knows this, it splits its detection accordingly. We call this **registry-anchored segmentation**.

## What's in the Registry That Helps

Indian land records contain more useful information than people realize. Here's what we can extract:

### From the Khatauni / RoR (Record of Rights)
- Khasra number
- Owner name
- Area in local units (bigha, guntha, acre, hectare)
- Land type (agricultural, residential, etc.)
- Adjacent plot references (sometimes)

### From the Field Measurement Book (FMB)
The FMB is a gold mine. It contains:
- Plot corner coordinates (sometimes as lat/lng, sometimes as offsets from a benchmark)
- Side lengths in meters or feet
- Bearings (compass directions for each side)
- The exact polygon shape

### From the 7/12 Extract (Maharashtra)
- Survey number with sub-divisions
- Adjacent plot listings ("north: Khasra 122, east: road, ...")
- Land classification

### From Mutation Records
- History of how plots were subdivided
- When one parcel became multiple

## The Five Anchoring Modes

We use the registry differently depending on what data exists. Here are the five modes, in order of accuracy:

### Mode 1 — Use the registry polygon directly

When Bhu-Naksha has already digitized a polygon for this plot, we just use it. No AI needed.

**Confidence: 100%**

### Mode 2 — Reconstruct from FMB corner coordinates

When the FMB has exact corner coordinates, we draw the polygon from those corners. This is geometrically exact.

```
Anchor point: (28.6139, 77.2090)
Corner 1: 50m south, 0m east   → (28.6094, 77.2090)
Corner 2: 50m south, 30m east  → (28.6094, 77.2120)
Corner 3: 0m south, 30m east   → (28.6139, 77.2120)
Back to anchor.
```

**Confidence: 95-99%** (depends on FMB accuracy)

### Mode 3 — AI segmentation + registry constraints

The AI segments visually. Then we enforce registry rules:

- "This village has 47 plots" → AI output must split into exactly 47 polygons
- "Khasra 123 is 0.5 acres" → That polygon's area must match (within 5%)
- "Khasra 122 is north of 123" → The topology must respect this

If the AI merges two plots into one (the Ram-Shyam rice paddy problem), we **split it** along the boundary suggested by registry metadata.

**Confidence: 75-90%**

### Mode 4 — Area-constrained splitting only

When we only know the count and total area:

- "Village has 47 plots totaling 23.4 acres"

The AI segments, then we use area-constrained partitioning to split merged polygons into the right number of pieces.

**Confidence: 60-80%**

### Mode 5 — Pure AI (no registry data)

When we have nothing from the registry, we rely entirely on AlphaEarth + SAM2 visual segmentation. The boundary is marked "needs verification."

**Confidence: 40-70%**

## A Bonus Feature: Discrepancy Detection

When we have **both** registry data **and** AI output, we can compare them. Mismatches are interesting:

- AI polygon is bigger than registry → possible **encroachment**
- AI sees two plots where registry has one → **unregistered subdivision**
- Registry has one plot, AI agrees → all good

This becomes a feature: **"Verify your land matches its registry record."** Valuable for:
- Buyers doing due diligence before purchase
- Banks validating mortgage collateral
- Lawyers preparing for disputes
- Citizens checking for encroachment

No competitor offers this today.

## Technical Implementation Sketch

```python
# In landlens-segmentation
def detect_parcel(lat, lng):
    # Step 1: Check registry
    registry_data = get_registry_record(lat, lng)
    
    if registry_data.has_full_polygon:
        return registry_data.polygon, mode="hard_anchored", confidence=1.0
    
    if registry_data.has_fmb_corners:
        polygon = reconstruct_from_corners(registry_data.fmb_corners)
        return polygon, mode="fmb_reconstructed", confidence=0.97
    
    # Step 2: Run AI segmentation
    ai_polygon = sam2_with_alphaearth(lat, lng)
    
    # Step 3: Apply registry constraints if available
    if registry_data.has_plot_count_and_areas:
        polygons = area_constrained_split(
            ai_polygon, 
            target_count=registry_data.plot_count,
            target_areas=registry_data.plot_areas
        )
        return polygons, mode="ai_with_constraints", confidence=0.85
    
    # Step 4: Pure AI fallback
    return ai_polygon, mode="ai_only", confidence=0.65
```

## Why This Matters

Without registry anchoring, LandLens would be just another AI map — pretty but legally meaningless.

With registry anchoring, LandLens becomes a **trustworthy tool for due diligence** because every polygon either:
- Comes from official records, or
- Has been validated against official records

This is the difference between a research demo and a real product that lawyers and banks can rely on.

## What's Next

→ Read [Boundary Segmentation](./04-boundary-segmentation.md) for how the AI part works.
→ Read [AI Service](./08-ai-service.md) for the separate Python service that implements all this.
