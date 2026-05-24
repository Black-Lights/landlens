import { NextResponse } from 'next/server';
import { generateOpenApiDocument } from '@/lib/api/openapi';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(generateOpenApiDocument(), {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
