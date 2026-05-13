import { type NextRequest, type NextResponse } from 'next/server';
import { SESSION_EXPIRY_MS, PERSISTENT_EXPIRY_MS } from './tokens';

export const REFRESH_COOKIE      = 'jireh_rt';
export const SESSION_TYPE_COOKIE = 'jireh_st'; // '1' = persistent; absent/empty = session-only

const BASE_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth', // browser only sends these cookies to /api/auth/* routes
};

/**
 * Sets the refresh-token cookie and a session-type indicator.
 * - persistent=true  → 30-day maxAge (survives browser close)
 * - persistent=false → no maxAge (session cookie, dies on browser close)
 */
export function setRefreshCookie(res: NextResponse, token: string, persistent: boolean): void {
  const maxAge = persistent ? PERSISTENT_EXPIRY_MS / 1000 : undefined;
  const stMaxAge = persistent ? PERSISTENT_EXPIRY_MS / 1000 : SESSION_EXPIRY_MS / 1000;

  res.cookies.set(REFRESH_COOKIE, token, {
    ...BASE_COOKIE,
    ...(maxAge !== undefined ? { maxAge } : {}),
  });

  // Session-type indicator — lets the refresh route know how to re-set the cookie.
  // Always has an explicit maxAge so it survives at least as long as the DB token.
  res.cookies.set(SESSION_TYPE_COOKIE, persistent ? '1' : '0', {
    ...BASE_COOKIE,
    maxAge: stMaxAge,
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE,      '', { ...BASE_COOKIE, maxAge: 0 });
  res.cookies.set(SESSION_TYPE_COOKIE, '', { ...BASE_COOKIE, maxAge: 0 });
}

/** Reads the session-type indicator from an incoming request. */
export function isPersistentSession(request: NextRequest): boolean {
  return request.cookies.get(SESSION_TYPE_COOKIE)?.value === '1';
}
