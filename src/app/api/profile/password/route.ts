import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createAuthClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { current_password, new_password } = body as Record<string, unknown>;

  if (typeof current_password !== 'string' || !current_password) {
    return NextResponse.json({ error: 'current_password is required' }, { status: 400 });
  }
  if (typeof new_password !== 'string' || new_password.length < 8) {
    return NextResponse.json({ error: 'new_password must be at least 8 characters' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the user's email so we can verify their current password.
  const { data: { user }, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !user?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify current password by attempting a sign-in.
  const auth = createAuthClient();
  const { error: signInErr } = await auth.auth.signInWithPassword({
    email: user.email,
    password: current_password,
  });
  if (signInErr) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  // Current password is correct — update to the new one.
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    password: new_password,
  });
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
