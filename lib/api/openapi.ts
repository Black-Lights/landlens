// Zod → OpenAPI 3.1 registry.
// Every API route registers its schema here so /api/openapi.json
// returns a single, complete, machine-readable spec.

import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ── Shared schemas ──────────────────────────────────────────────────────────

export const ErrorResponseSchema = registry.register(
  'ErrorResponse',
  z
    .object({
      error: z.object({
        code: z.string().openapi({ example: 'PARCEL_NOT_FOUND' }),
        message: z.string(),
        suggested_action: z.string().optional(),
        docs_url: z.string().url().optional(),
        details: z.unknown().optional(),
      }),
    })
    .openapi('ErrorResponse'),
);

// ── Parcel / village / district schemas (Sprint 3) ──────────────────────────

export const LngLatSchema = z.tuple([z.number(), z.number()]).openapi({ example: [73.85, 18.52] });

export const OwnerSchema = registry.register(
  'OwnershipRecord',
  z
    .object({
      id: z.string().uuid(),
      owner_name: z.string(),
      father_or_spouse: z.string().nullable().optional(),
      ownership_type: z.string().nullable().optional(),
      share_fraction: z.string().nullable().optional(),
      transfer_date: z.string().nullable().optional(),
      registration_date: z.string().nullable().optional(),
      is_current: z.boolean(),
    })
    .openapi('OwnershipRecord'),
);

export const ParcelDetailSchema = registry.register(
  'ParcelDetail',
  z
    .object({
      id: z.string().uuid(),
      khasra_no: z.string().nullable(),
      area_sqm: z.number(),
      area_acres: z.number(),
      area_hectares: z.number(),
      land_type: z.string().nullable(),
      boundary_source: z.string(),
      village: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
      district: z.object({ id: z.string().uuid(), name: z.string(), lgd_code: z.string().nullable() }).nullable(),
      state: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
      geometry: z.unknown(),
      owners: z.array(OwnerSchema),
    })
    .openapi('ParcelDetail'),
);

export const SearchResultSchema = registry.register(
  'SearchResult',
  z
    .object({
      type: z.enum(['state', 'district', 'village', 'khasra', 'owner']),
      id: z.string(),
      label: z.string(),
      sublabel: z.string().nullable(),
      parcel_id: z.string().uuid().nullable(),
      ancestors: z.object({
        state: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
        district: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
        village: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
      }),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
      centroid: LngLatSchema.nullable(),
      score: z.number(),
    })
    .openapi('SearchResult'),
);

export const SearchResponseSchema = registry.register(
  'SearchResponse',
  z
    .object({
      query: z.string(),
      results: z.array(SearchResultSchema),
    })
    .openapi('SearchResponse'),
);

export const NearbyParcelSchema = registry.register(
  'NearbyParcel',
  z
    .object({
      id: z.string().uuid(),
      khasra_no: z.string().nullable(),
      land_type: z.string().nullable(),
      distance_m: z.number(),
      centroid: LngLatSchema,
    })
    .openapi('NearbyParcel'),
);

export const HealthResponseSchema = registry.register(
  'HealthResponse',
  z
    .object({
      status: z.enum(['ok', 'degraded', 'down']),
      db: z.enum(['ok', 'down', 'unconfigured']),
      redis: z.enum(['ok', 'down', 'unconfigured']),
      version: z.string().optional(),
      timestamp: z.string(),
    })
    .openapi('HealthResponse'),
);

// ── Route registrations ─────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'Liveness + dependency health',
  description:
    'Returns overall status and the state of each backing service (Postgres, Redis). Useful for uptime monitors and as a first test of the API stack.',
  responses: {
    200: {
      description: 'Health snapshot',
      content: { 'application/json': { schema: HealthResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/openapi.json',
  summary: 'OpenAPI 3.1 specification',
  description: 'Auto-generated from Zod schemas. Source of truth for AI agents.',
  responses: {
    200: {
      description: 'OpenAPI document',
      content: { 'application/json': { schema: z.unknown() } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/districts',
  summary: 'District boundaries for a state',
  description:
    'Returns a GeoJSON FeatureCollection of district polygons for the requested state, or 404 if no boundary file is bundled yet. Sourced from datameet-style census shapefiles, simplified for the web.',
  request: { query: z.object({ state: z.string().openapi({ example: 'Maharashtra' }) }) },
  responses: {
    200: { description: 'GeoJSON FeatureCollection', content: { 'application/geo+json': { schema: z.unknown() } } },
    404: { description: 'No bundled districts for the state', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/villages',
  summary: 'Village (admin_level=7|8) boundaries inside a bbox',
  description:
    'Looks up cached village polygons from `admin_boundaries`. On cache miss, calls OSM Overpass live and persists the result. Returns GeoJSON. Set `bbox=west,south,east,north`.',
  request: { query: z.object({ bbox: z.string().openapi({ example: '73.5,18.3,74.6,19.1' }), district_id: z.string().uuid().optional() }) },
  responses: {
    200: { description: 'GeoJSON FeatureCollection', content: { 'application/geo+json': { schema: z.unknown() } } },
    400: { description: 'Bad bbox', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/parcels/{id}',
  summary: 'Parcel detail with ownership history',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Parcel', content: { 'application/json': { schema: ParcelDetailSchema } } },
    404: { description: 'No parcel with that id', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/parcels/by-village',
  summary: 'All parcels inside a village (GeoJSON)',
  request: { query: z.object({ village_id: z.string().uuid() }) },
  responses: {
    200: { description: 'GeoJSON FeatureCollection', content: { 'application/geo+json': { schema: z.unknown() } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/search',
  summary: 'Unified search across boundaries, parcels, and owners',
  description:
    'Returns ranked matches across states, districts, villages, khasra numbers, and ownership records. Backed by Postgres pg_trgm for typo-tolerance and the multilingual name columns (name_en / name_hi / name_local). Exact > prefix > trigram similarity. Each result carries an ancestor chain and either a bbox (for boundary types) or centroid (for parcel types) suitable for `flyTo`.',
  request: {
    query: z.object({
      q: z.string().min(1).max(120).openapi({ example: 'pune' }),
      type: z.enum(['state', 'district', 'village', 'khasra', 'owner']).optional(),
      state: z.string().optional().openapi({
        description: 'Restrict to a state by LGD code or name. Honoured by all types except none.',
      }),
      limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Ranked search results, highest-score first',
      content: { 'application/json': { schema: SearchResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/parcels/nearby',
  summary: 'Nearest N parcels to a point (used by Locate Me)',
  request: {
    query: z.object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      limit: z.coerce.number().int().min(1).max(50).default(5).optional(),
      radius_m: z.coerce.number().int().min(50).max(50000).default(2000).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Ranked nearest parcels',
      content: { 'application/json': { schema: z.object({ parcels: z.array(NearbyParcelSchema) }) } },
    },
  },
});

// ── Generator ───────────────────────────────────────────────────────────────

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'LandLens API',
      version: '0.1.0',
      description:
        'Pan-India cadastral platform. See land.trenlens.com. This spec is auto-generated from Zod schemas and is the canonical machine-readable description of the API.',
      license: {
        name: 'PolyForm Noncommercial 1.0.0',
        url: 'https://polyformproject.org/licenses/noncommercial/1.0.0/',
      },
    },
    servers: [
      { url: 'https://land.trenlens.com', description: 'Production' },
      { url: 'http://localhost:3000', description: 'Local' },
    ],
  });
}
