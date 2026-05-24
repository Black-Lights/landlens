// Upstash Redis client — HTTP-based, works on Vercel Edge runtime.
// Returns null when env is unset so health checks can report `redis: 'unconfigured'`
// instead of throwing during local dev before secrets are populated.
import { Redis } from '@upstash/redis';

let cached: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (cached !== undefined) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cached = null;
    return cached;
  }
  cached = new Redis({ url, token });
  return cached;
}
