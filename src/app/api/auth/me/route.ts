import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// This route is protected by middleware — x-user-id is injected.
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  const [profileResult, userResult] = await Promise.all([
    db.from('profiles').select('full_name, role, avatar_url').eq('id', userId).single(),
    db.auth.admin.getUserById(userId),
  ]);

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const profile = profileResult.data;
  const email = userResult.data.user?.email ?? null;

  return NextResponse.json({
    user: {
      id: userId,
      email,
      name: profile.full_name ?? null,
      role: (profile.role ?? 'staff') as 'admin' | 'staff',
      avatar: profile.avatar_url ?? null,
    },
  });
}
