import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { signAccessToken } from '@/lib/auth/jwt';
import {
  generateRefreshToken,
  rotateRefreshToken,
  getRefreshTokenRecord,
  SESSION_EXPIRY_MS,
  PERSISTENT_EXPIRY_MS,
} from '@/lib/auth/tokens';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie, isPersistentSession } from '@/lib/auth/cookies';
import { rateLimit, getIp } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  // Prevent brute-forcing refresh tokens
  const { allowed, retryAfterSeconds } = rateLimit(
    `refresh:${getIp(request)}`,
    20,
    15 * 60 * 1000
  );

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      }
    );
  }

  const oldRefreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!oldRefreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  // Look up the token before rotation (needed to get user_id)
  const record = await getRefreshTokenRecord(oldRefreshToken);

  if (!record) {
    // Token not found — could be expired and cleaned up, or tampered with
    const response = NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    clearRefreshCookie(response);
    return response;
  }

  const userId = record.user_id;
  const persistent = isPersistentSession(request);
  const newRefreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + (persistent ? PERSISTENT_EXPIRY_MS : SESSION_EXPIRY_MS));

  const rotated = await rotateRefreshToken(oldRefreshToken, userId, newRefreshToken, expiresAt);

  if (!rotated) {
    // Either expired, revoked (reuse detected), or user mismatch
    const response = NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    clearRefreshCookie(response);
    return response;
  }

  // Fetch current role (might have changed since last login)
  const db = createAdminClient();
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const role = profile?.role ?? 'staff';

  const accessToken = await signAccessToken(userId, role);

  const response = NextResponse.json({ accessToken });
  setRefreshCookie(response, newRefreshToken, persistent);

  return response;
}
