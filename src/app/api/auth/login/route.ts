import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/lib/supabase/server';
import { signAccessToken } from '@/lib/auth/jwt';
import {
    generateRefreshToken,
    storeRefreshToken,
    SESSION_EXPIRY_MS,
    PERSISTENT_EXPIRY_MS,
} from '@/lib/auth/tokens';
import { setRefreshCookie } from '@/lib/auth/cookies';
import { rateLimit, getIp } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
    // 5 attempts per 15 minutes per IP
      const { allowed, retryAfterSeconds } = rateLimit(
        `login:${getIp(request)}`,
        5,
        15 * 60 * 1000
      );

      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many login attempts. Please try again later.' },
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

    const { email, password, rememberMe } = body as Record<string, unknown>;
    const persistent = rememberMe === true;

    if (typeof email !== 'string' || typeof password !== 'string') {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (password.length < 6) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }


    // Verify credentials with Supabase Auth
    const authClient = createAuthClient();
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
    });

    // Generic error — don't reveal whether email exists or not (user enumeration)
    if (authError || !authData.user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const userId = authData.user.id;

    // Fetch role from profiles table
    const db = createAdminClient();
    const { data: profile } = await db
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single();

    const role = profile?.role ?? 'staff';

    // Issue tokens
    const accessToken = await signAccessToken(userId, role);
    const refreshToken = generateRefreshToken();
    const family = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (persistent ? PERSISTENT_EXPIRY_MS : SESSION_EXPIRY_MS));

    try {
        await storeRefreshToken(userId, refreshToken, family, expiresAt);
    } catch (err) {
        console.error('[login] storeRefreshToken failed — is migration 002 applied?', err);
        return NextResponse.json(
            { error: 'Server error: could not create session. Check that migration 002 has been run in Supabase.' },
            { status: 500 }
        );
    }

    const response = NextResponse.json({
        accessToken,
        user: {
            id: userId,
            email: authData.user.email,
            name: profile?.full_name ?? null,
            role,
        },
    });

    setRefreshCookie(response, refreshToken, persistent);

    return response;
}
