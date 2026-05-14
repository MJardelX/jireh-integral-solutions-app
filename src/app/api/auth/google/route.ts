import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { signAccessToken } from '@/lib/auth/jwt';
import {
  generateRefreshToken,
  storeRefreshToken,
  REFRESH_TOKEN_EXPIRY_MS,
} from '@/lib/auth/tokens';
import { setRefreshCookie } from '@/lib/auth/cookies';
import { rateLimit, getIp } from '@/lib/auth/rate-limit';

interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: string;
  name?: string;
  picture?: string;
  aud: string;
}

async function verifyGoogleToken(idToken: string): Promise<GoogleTokenInfo> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  if (!res.ok) throw new Error('Invalid Google token');

  const info: GoogleTokenInfo = await res.json();

  if (info.email_verified !== 'true') throw new Error('Google email not verified');

  // Verify the token was issued for our app
  if (info.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Token audience mismatch');
  }

  return info;
}

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(
    `google:${getIp(request)}`,
    10,
    15 * 60 * 1000
  );

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { token: googleIdToken } = body as Record<string, unknown>;

  if (typeof googleIdToken !== 'string' || !googleIdToken) {
    return NextResponse.json({ error: 'Google ID token is required' }, { status: 400 });
  }

  let googleUser: GoogleTokenInfo;
  try {
    googleUser = await verifyGoogleToken(googleIdToken);
  } catch {
    return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
  }

  const db = createAdminClient();

  // Find or create the user in Supabase Auth
  const { data: existingUsers } = await db.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find(
    (u) => u.email === googleUser.email
  );

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // First time Google sign-in — create the auth user
    const { data: newUser, error } = await db.auth.admin.createUser({
      email: googleUser.email,
      email_confirm: true,
      user_metadata: {
        full_name: googleUser.name,
        avatar_url: googleUser.picture,
        provider: 'google',
      },
    });

    if (error || !newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    userId = newUser.user.id;
  }

  // Fetch profile (created by the DB trigger on auth.users insert)
  const { data: profile } = await db
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', userId)
    .single();

  const role = profile?.role ?? 'staff';

  // Issue tokens
  const accessToken = await signAccessToken(userId, role);
  const refreshToken = generateRefreshToken();
  const family = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await storeRefreshToken(userId, refreshToken, family, expiresAt);

  const response = NextResponse.json({
    accessToken,
    user: {
      id: userId,
      email: googleUser.email,
      name: profile?.full_name ?? googleUser.name ?? null,
      avatar: profile?.avatar_url ?? googleUser.picture ?? null,
      role,
    },
  });

  setRefreshCookie(response, refreshToken, false);

  return response;
}
