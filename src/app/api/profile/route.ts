import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { full_name, avatar_url } = body as Record<string, unknown>;

  const patch: Record<string, string | null> = {};
  if (full_name !== undefined) {
    if (typeof full_name !== 'string' && full_name !== null) {
      return NextResponse.json({ error: 'full_name must be a string or null' }, { status: 400 });
    }
    patch.full_name = typeof full_name === 'string' ? full_name.trim() || null : null;
  }
  if (avatar_url !== undefined) {
    if (typeof avatar_url !== 'string' && avatar_url !== null) {
      return NextResponse.json({ error: 'avatar_url must be a string or null' }, { status: 400 });
    }
    patch.avatar_url = typeof avatar_url === 'string' ? avatar_url.trim() || null : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db.from('profiles').update(patch).eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
