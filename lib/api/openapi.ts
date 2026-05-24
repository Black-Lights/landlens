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
