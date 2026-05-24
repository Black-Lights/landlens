// Health check — useful for uptime monitors and as the first end-to-end
// test of the API stack. Reports independently for DB and Redis so a
// missing dependency degrades rather than fails.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRedis } from '@/lib/redis';
import { withErrors } from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ServiceState = 'ok' | 'down' | 'unconfigured';

async function checkDb(): Promise<ServiceState> {
  if (!process.env.DATABASE_URL) return 'unconfigured';
  try {
    await db.$queryRaw`SELECT 1`;
    return 'ok';
  } catch {
    return 'down';
  }
}

async function checkRedis(): Promise<ServiceState> {
  const redis = getRedis();
  if (!redis) return 'unconfigured';
  try {
    await redis.ping();
    return 'ok';
  } catch {
    return 'down';
  }
}

export const GET = withErrors(async () => {
  const [dbState, redisState] = await Promise.all([checkDb(), checkRedis()]);
  const anyDown = dbState === 'down' || redisState === 'down';
  const anyUnconfigured = dbState === 'unconfigured' || redisState === 'unconfigured';
  const status: 'ok' | 'degraded' | 'down' = anyDown ? 'down' : anyUnconfigured ? 'degraded' : 'ok';

  return NextResponse.json({
    status,
    db: dbState,
    redis: redisState,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    timestamp: new Date().toISOString(),
  });
});
