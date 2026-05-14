import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { signAccessToken } from '@/lib/auth/jwt';
import { generateRefreshToken, storeRefreshToken, SESSION_EXPIRY_MS } from '@/lib/auth/tokens';
import { setRefreshCookie } from '@/lib/auth/cookies';

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const { supabaseToken, password, name } = body as Record<string, unknown>;

  if (typeof supabaseToken !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'supabaseToken and password are required' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the Supabase access token from the invite link
  const { data: { user: sbUser }, error: getUserError } = await admin.auth.getUser(supabaseToken);
  if (getUserError || !sbUser) {
    return NextResponse.json({ error: 'El enlace de invitación es inválido o ha expirado' }, { status: 401 });
  }

  // Set the invited user's password
  const { error: pwError } = await admin.auth.admin.updateUserById(sbUser.id, { password });
  if (pwError) {
    return NextResponse.json({ error: 'No se pudo establecer la contraseña' }, { status: 500 });
  }

  // Create or update the profile row
  const fullName = typeof name === 'string' && name.trim()
    ? name.trim()
    : (sbUser.user_metadata?.full_name ?? null);

  await admin.from('profiles').upsert(
    { id: sbUser.id, full_name: fullName, role: 'staff' },
    { onConflict: 'id', ignoreDuplicates: false }
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', sbUser.id)
    .single();

  const role = profile?.role ?? 'staff';

  // Issue custom tokens (same flow as /api/auth/login)
  const accessToken = await signAccessToken(sbUser.id, role);
  const refreshToken = generateRefreshToken();
  const family = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

  await storeRefreshToken(sbUser.id, refreshToken, family, expiresAt);

  const response = NextResponse.json({
    accessToken,
    user: {
      id:    sbUser.id,
      email: sbUser.email,
      name:  profile?.full_name ?? null,
      role,
    },
  });

  setRefreshCookie(response, refreshToken, false);
  return response;
}
