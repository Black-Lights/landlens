# 15 — Enterprise Tier

> The commercial offering, when it ships in Phase 2. What's in it, who it's for, and what hooks LandLens already builds in Phase 1 to make the transition painless.

## Pre-Reading

This doc assumes you've read [Licensing & Commercial Strategy](./14-licensing.md). The license transition (PolyForm NC → dual license) is the legal half; this doc is the product half.

## Who Pays, Who Doesn't

| User | Tier | Cost |
|---|---|---|
| Citizens browsing the map | Community | Free, forever |
| Researchers / academics | Community | Free |
| Internal evaluations | Community | Free for 30 days, then Developer |
| Solo developers building on the API | Developer | ~$29/mo (indicative) |
| Banks doing collateral checks | Business | ~$499/mo |
| Government departments | Enterprise | Annual contract |
| Companies embedding LandLens (white-label) | Enterprise | Annual contract |

The map itself stays free. **What you pay for is automation, scale, and trust signals.**

## Tier Capabilities

```
                       Community  Developer  Business  Enterprise
                       ─────────  ─────────  ────────  ──────────
Browse map               ✓         ✓         ✓          ✓
Click for parcel         ✓         ✓         ✓          ✓
Bookmark parcels         ✓         ✓         ✓          ✓
Multilingual UI          ✓         ✓         ✓          ✓
Public API rate          60/min   6,000/min  60,000/min custom
Export parcels           100/mo    10,000/mo unlimited  unlimited
Bulk export (GeoJSON)    ✗         ✓         ✓          ✓
PostGIS direct read      ✗         ✗         ✓          ✓
Historical ownership     5 years   5 years   unlimited  unlimited
Encroachment detection   ✗         ✗         ✓          ✓
Custom segmentation jobs ✗         ✗         ✓          ✓
White-label embed        ✗         ✗         ✗          ✓
Webhook notifications    ✗         ✗         ✓          ✓
Audit log access         ✗         ✗         ✓          ✓
Dedicated SLA            ✗         ✗         ✗          99.9%
On-call support          ✗         ✗         email     phone
```

## What Phase 1 Already Builds (So Phase 2 Is a Flag Flip)

The point of doing this work now is to avoid a re-architecture later.

### Tier-aware API keys

`api_keys` and `api_usage` tables exist from day one. Every key gets a `tier ∈ {community, developer, business, enterprise}`. Phase 1: everyone is `community`. Phase 2: a billing flow flips tiers.

### Rate-limit middleware reads tier

```ts
// middleware.ts
const tier = await getKeyTier(request);
const limit = TIER_LIMITS[tier];
const result = await ratelimit(tier).limit(request.ip);
```

`TIER_LIMITS` is a constant. Changing limits is a config change, not a code change.

### Feature flags for commercial features

Wired in `lib/features.ts`, all default `false` in Phase 1:

```ts
export const COMMERCIAL_FEATURES = {
  bulk_export_unlimited: false,
  postgis_direct_access: false,
  historical_ownership_5plus_years: false,
  encroachment_detection: false,
  custom_segmentation_jobs: false,
  white_label_embed: false,
  webhook_notifications: false,
  audit_log_access: false,
  dedicated_sla: false,
};
```

Every commercial feature reads its flag before activating. Phase 2 = flip the flags per tier. Zero refactor.

### Usage instrumentation

Every API call writes to `api_usage` (key id, endpoint, status, response time, timestamp). The data exists from day one even though we're not billing on it yet. When billing turns on, we have months of history to calibrate prices against.

### Audit log

`access_log` records every parcel view in Phase 1 (for compliance). In Phase 2, Business and Enterprise tiers gain **access to their own slice** of this log via `/api/audit-log?api_key=...`. The same table powers both — only the access control changes.

## Phase 2 Additions (Not in Phase 1)

These don't get built in Phase 1, but are designed for now so they slot in cleanly:

### Billing

Stripe is the path of least resistance. One product per tier, metered usage add-ons for API overage:

```
Developer plan:  base $29/mo  + $0.001 per API call over 250k/mo
Business plan:   base $499/mo + $0.0005 per API call over 5M/mo
```

A `stripe_customer_id` column will be added to `api_keys`; webhook handler at `/api/webhooks/stripe`.

### Webhook notifications (Business tier)

Customers register endpoints they want notified on mutations:

```
POST /api/v1/webhooks
{ "event": "parcel.ownership_changed", "url": "...", "secret": "..." }
```

Backed by an `outgoing_webhooks` table. Delivery uses exponential backoff with a 24-hour retry window. Standard pattern; nothing exotic.

### White-label embed (Enterprise tier)

An embeddable iframe with custom theming. A bank can put a "Verify your collateral parcel" widget on their own site:

```html
<iframe src="https://embed.land.trenlens.com/?key=...&theme=hdfc" />
```

Themes live in `themes/<tier-or-customer>.json`. Locked behind `ENABLE_WHITE_LABEL`.

### PostGIS direct access (Business+)

A read-only Postgres role per customer, exposed via a connection-pooled endpoint. Customers run their own SQL. Hard guardrails:

- Read-only
- Per-customer schema with row-level security
- Query timeout 30 seconds
- Result row cap 100,000

Useful for analysts who'd rather write SQL than learn a REST API.

### Custom segmentation jobs (Business+)

Customers submit areas for priority AI segmentation:

```
POST /api/v1/segmentation/jobs
{ "geometry": {...}, "priority": "rush", "callback_url": "..." }
```

Routes to the [AI Service](./08-ai-service.md). Rush priority bypasses the nightly batch queue.

### Encroachment detection report (Business+)

Surfaces the [discrepancy detection](./04-boundary-segmentation.md#discrepancy-detection) signal as a paid report:

```
POST /api/v1/reports/encroachment
{ "parcel_id": "..." }
```

Returns a PDF with the registry polygon, AI polygon, overlap diff, Hausdorff distance, area delta, and a confidence score. Banks and lawyers pay for this output.

## Pricing Discipline

Two principles:

1. **The map is always free.** Charging citizens to look up their own land is wrong. We do not.
2. **Charge for automation, not for data.** A human clicking around for an hour is free. A program making 10,000 API calls is paid. The data is the same; the load and the value extraction are not.

## Migration Path for Existing Users

When Phase 2 launches, every existing user stays on Community tier with no behavior change. They opt **in** to a paid tier if they want the commercial features. No retroactive paywall.

## What We Won't Build

Common requests we're declining up front:

- **Per-search payments.** Nickel-and-diming the wrong audience.
- **Ads.** Cadastral platforms with ads look untrustworthy. Trust is the product.
- **Selling owner data to advertisers.** Hard no, forever. See [Section 13 of the project prompt](../CLAUDE_CODE_PROMPT.md) on privacy.
- **Tier gates on accessibility features.** Screen reader support, RTL, large-text mode are free at every tier.

## Open Questions

These will be settled before Phase 2 launches:

- Do we offer an academic tier between Community and Developer, or rely on PolyForm NC to cover academic use?
- Is `business` tier per-seat or per-organization?
- How do government departments pay — annual contract, or a fixed central deal with a state?
- What's the SLA wording for the Enterprise tier — 99.9%, with what credit on breach?

Each gets resolved when the first customer asks.

## What's Next

You've reached the end of the documentation. Loop back to the [README](./README.md) if you want to revisit anything, or jump into the [project prompt](../CLAUDE_CODE_PROMPT.md) to start building.
