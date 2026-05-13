import { NextRequest, NextResponse } from 'next/server';
import { revokeRefreshToken } from '@/lib/auth/tokens';
import { REFRESH_COOKIE, clearRefreshCookie } from '@/lib/auth/cookies';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    // Best-effort revocation — don't fail the logout if the token is already gone
    await revokeRefreshToken(refreshToken).catch(() => null);
  }

  const response = NextResponse.json({ success: true });
  clearRefreshCookie(response);

  return response;
}
