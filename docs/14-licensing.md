# 14 — Licensing & Commercial Strategy

> How LandLens is licensed today, how it converts to a commercial offering later, and how Google Earth Engine's licensing fits in.

## Two Separate Licenses to Track

When LandLens uses Google Earth Engine for AI segmentation, **two distinct licenses** are in play:

| What | License | Who controls it |
|---|---|---|
| **LandLens own code** | Our choice (PolyForm, MIT, etc.) | We do |
| **GEE / AlphaEarth usage** | Google's terms (non-commercial free, commercial paid) | Google does |

They are **independent**. The license you put on LandLens doesn't change Google's terms. When LandLens monetizes, *both* must transition: our license adds a commercial option, and we sign up for Google Earth Engine Commercial.

## Phase 1 — Now: Non-Commercial Open Source

### Our License: PolyForm Noncommercial 1.0.0

**Why this one:**
- Plain English (unlike GPL's lawyer-speak)
- Modern (2020), well-understood
- Clear: free for research, academia, evaluation; paid for revenue use
- Reversible — we can always add a second license later
- Already used by Sentry, MariaDB MaxScale, others

**What it allows:**
- Anyone can clone, modify, run LandLens
- Anyone can use it for academic research, including thesis work
- Personal use, internal evaluation, classroom teaching
- Forking and contributing back

**What it forbids:**
- Charging customers to use LandLens or anything built from it
- Hosting LandLens as a paid service
- Integrating LandLens into commercial products

That last point is important. Other companies cannot build a business on top of our code during this phase.

### Our GEE Registration: Non-Commercial Tier

GEE has its own qualification rules. We qualify because:
- Academic affiliation (thesis work)
- No revenue from LandLens
- No fee-for-service work

We register the GEE project as non-commercial. Free EECU quota applies (with monthly limits starting April 27, 2026). We monitor compute usage via Google Cloud Monitoring to stay within quota.

If we exceed quota, the project enters "Restricted mode" with slowed computations — not a billing event, just slower jobs.

## Phase 2 — Future: Commercial + Open Source (Dual License)

When LandLens starts offering paid services to companies, we switch to **dual licensing**.

### Dual License Model

Same code, two licenses depending on who uses it:

| Audience | License | Cost |
|---|---|---|
| Academics, researchers, individuals | PolyForm Noncommercial 1.0.0 | Free |
| Companies, government agencies, fee-for-service users | Commercial license | Subscription / contract |

This is exactly how MariaDB, Sentry, Cockroach, and many others do it. One codebase, two contracts.

### Our GEE Switch: Commercial Plan

When LandLens monetizes, we **must** switch GEE to commercial — regardless of whether we use AlphaEarth in the paid features. Even using GEE internally to generate data that ends up in a commercial product counts.

Steps:
1. Set up Google Cloud billing account
2. Subscribe to Earth Engine Commercial plan
3. Re-register GEE project under commercial billing
4. Pay per EECU consumed

Pricing is custom — quoted by Google sales based on workload.

### Enterprise API Tiers (Phase 2)

When we have a commercial license, here's how we offer it:

| Tier | Audience | Features | Price |
|---|---|---|---|
| **Community** | Academics | Map UI, 60 req/min, attribution required | Free |
| **Developer** | Indie devs | API access, 10k req/month | Free → ₹999/mo |
| **Business** | Real estate, fintech | 1M req/month, SLA, support | ₹25k-100k/mo |
| **Enterprise** | Banks, govt, large RE | Unlimited, dedicated infra, white-label, custom data | Contract |

### Features to Gate Behind Commercial

- Bulk export beyond 100 parcels
- Direct PostGIS read access
- Historical data deeper than 5 years
- Discrepancy detection (encroachment alerts)
- Custom segmentation jobs
- White-label embedding
- SLA and dedicated support
- Audit log access
- Webhook notifications

## Alternative Licenses Considered

| License | Why we didn't pick it |
|---|---|
| MIT | Too permissive — companies could fork for free and outcompete us |
| AGPL | Strong copyleft, scares enterprises — most won't even read it |
| BSL 1.1 (Business Source) | Good option — auto-converts to Apache after 4 years. Used by HashiCorp, Sentry. Choose this if we want to *commit* to eventual openness. |
| Apache 2.0 | Same as MIT problem — too permissive |
| Custom EULA | Too much legal overhead for early stage |

PolyForm Noncommercial wins for now. BSL 1.1 is our backup if we want time-bombed open-sourcing.

## Practical Steps

### Today
1. Add `LICENSE` file with PolyForm Noncommercial 1.0.0 text
2. Add header comment to each source file: `// LandLens — PolyForm Noncommercial 1.0.0`
3. Register GEE project as non-commercial
4. Add `NOTICE.md` listing third-party licenses (AlphaEarth attribution, SAM2 Apache 2.0, etc.)
5. Update README with clear license statement

### Before going commercial
1. Engage a lawyer for commercial license template (~₹50k one-time)
2. Set up Google Cloud billing + GEE Commercial subscription
3. Add a `COMMERCIAL.md` explaining the dual-license offer
4. Add usage tracking + tier enforcement to the API
5. Add contact form for enterprise inquiries

## Important Attribution Notes

These come from third-party licenses we must respect regardless of our own license:

- **AlphaEarth Foundations**: CC-BY 4.0 license, requires attribution text: "The AlphaEarth Foundations Satellite Embedding dataset was created by Google and Google DeepMind"
- **SAM2 (Meta)**: Apache 2.0 — include LICENSE in our repo
- **Sentinel-2 data**: Copernicus license — attribute "Contains modified Copernicus Sentinel data"
- **OpenStreetMap**: ODbL — attribute "© OpenStreetMap contributors"
- **NIC Bhu-Naksha derived data**: where we scrape, we should attribute the source state portal

All of these go in a `/credits` page on the LandLens website and in the API responses for transparency.

## What's Next

→ Read [Enterprise Tier](./15-enterprise-tier.md) for how the paid API will work.
