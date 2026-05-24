// Server-side Supabase clients backed by Next.js cookies.
//
// Two helpers:
//   - `supabaseServer()`         — full read/write cookie access (route handlers,
//                                  server actions, middleware).
//   - `supabaseServerReadOnly()` — read-only cookies for RSC contexts where
//                                  `cookies().set()` throws. Safe to call from
//                                  `app/` server components.
//
// Auth state is read via the `sb-*` cookies set by @supabase/ssr. Session
// refresh happens in the root middleware so route handlers don't have to.
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assertEnv(): { url: string; anonKey: string } {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }
  return { url, anonKey };
}

export function supabaseServer() {
  const { url, anonKey } = assertEnv();
  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });
}

// In Server Components the cookie store is read-only — calling `.set()` throws.
// We swallow those calls so RSC code can `await supabase.auth.getUser()` safely;
// real session refresh happens in middleware.
export function supabaseServerReadOnly() {
  const { url, anonKey } = assertEnv();
  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        /* RSC: ignored */
      },
      remove() {
        /* RSC: ignored */
      },
    },
  });
}
