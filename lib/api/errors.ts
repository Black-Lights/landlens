// Structured error responses — AI agents and humans both read these.
// Shape: { error: { code, message, suggested_action, docs_url } }
// See docs/11-ai-first-architecture.md.

import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PARCEL_NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'RATE_LIMITED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_FAILED'
  | 'INTERNAL'
  | 'SERVICE_UNAVAILABLE';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  suggested_action?: string;
  docs_url?: string;
  details?: unknown;
}

const HTTP_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PARCEL_NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
};

const DOCS_BASE = 'https://land.trenlens.com/docs/errors';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly suggestedAction?: string;
  readonly docsUrl: string;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, opts: { suggested_action?: string; docs_url?: string; details?: unknown } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.suggestedAction = opts.suggested_action;
    this.docsUrl = opts.docs_url ?? `${DOCS_BASE}/${code}`;
    this.details = opts.details;
  }

  toResponse(): NextResponse {
    const body: { error: ErrorBody } = {
      error: {
        code: this.code,
        message: this.message,
        suggested_action: this.suggestedAction,
        docs_url: this.docsUrl,
        details: this.details,
      },
    };
    return NextResponse.json(body, { status: this.status });
  }
}

/// Wrap a route handler — translates ApiError + ZodError into structured JSON.
export function withErrors<T extends (...args: never[]) => Promise<Response>>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) return err.toResponse();
      // Zod errors get unwrapped here without taking a hard import dep at top level.
      if (err && typeof err === 'object' && 'issues' in err && Array.isArray((err as { issues: unknown[] }).issues)) {
        return new ApiError('VALIDATION_FAILED', 'Request did not match the expected schema.', {
          suggested_action: 'Check /api/openapi.json for the expected request shape.',
          details: (err as { issues: unknown[] }).issues,
        }).toResponse();
      }
      console.error('[api] unhandled error', err);
      return new ApiError('INTERNAL', 'An unexpected error occurred.').toResponse();
    }
  }) as T;
}
