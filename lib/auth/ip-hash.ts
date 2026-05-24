// SHA-256 of the request IP, salted with a monthly-rotating value so we can
// rate-limit / detect abuse without storing raw IPs. The salt also rotates
// per UTC month, so even the hash itself isn't a long-lived identifier.
//
// Why this matters: DPDP Act 2023 considers IPs personal data when paired
// with timestamps. Hashing breaks that link, monthly rotation breaks
// cross-month correlation.

import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';

const FALLBACK_SALT = 'landlens-dev-only-not-for-prod';

function monthlySalt(now: Date = new Date()): string {
  const base = process.env.IP_HASH_SALT ?? FALLBACK_SALT;
  const yyyymm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${base}:${yyyymm}`;
}

export function hashIp(ip: string | null, now: Date = new Date()): string | null {
  if (!ip) return null;
  const salt = monthlySalt(now);
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

// Best-effort IP extraction. Prefers `x-forwarded-for` (set by Vercel /
// Cloudflare), falls back to `x-real-ip`, then to null. We deliberately don't
// reach into the platform's raw socket — the values above are what reverse
// proxies expose and what the rate limiter already uses.
export function clientIp(request: Request | NextRequest): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}

// Crude bot detector — we skip audit logging when one of these strings shows
// up in the UA so the log isn't drowned in crawler hits. The list is short
// on purpose: rare false positives are acceptable here.
const BOT_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawler/i,
  /headlesschrome/i,
  /puppeteer/i,
  /scrapy/i,
  /facebookexternalhit/i,
  /preview/i,
];

export function isBotUserAgent(ua: string | null): boolean {
  if (!ua) return true; // missing UA → bot-ish; skip logging
  return BOT_PATTERNS.some((re) => re.test(ua));
}
