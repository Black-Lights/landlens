// Audit-log helper. Writes to `access_log` with a hashed IP and never throws.
// Fire-and-forget from API routes: callers pass in the parcel id and request,
// and we log in the background so the response isn't blocked.

import { db } from '@/lib/db';
import { supabaseServerReadOnly } from '@/lib/supabase/server';
import { hashIp, clientIp, isBotUserAgent } from './ip-hash';

export async function logParcelAccess(
  request: Request,
  parcelId: string,
): Promise<void> {
  const userAgent = request.headers.get('user-agent');
  if (isBotUserAgent(userAgent)) return;

  try {
    // Resolve user lazily — anonymous viewers are still logged with null user_id.
    let userId: string | null = null;
    try {
      const supabase = supabaseServerReadOnly();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      // No cookies / no Supabase env → continue as anonymous.
    }

    const ip = clientIp(request);
    const ipHash = hashIp(ip);

    await db.$executeRaw`
      INSERT INTO access_log (user_id, parcel_id, ip_hash, user_agent)
      VALUES (
        ${userId}::uuid,
        ${parcelId}::uuid,
        ${ipHash},
        ${userAgent ? userAgent.slice(0, 500) : null}
      );
    `;
  } catch (err) {
    // Audit logging must never break the user-facing request.
    console.error('[audit] failed to log parcel access', err);
  }
}
