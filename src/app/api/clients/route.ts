import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { matchesTerm } from '@/lib/search';

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search    = searchParams.get('search') ?? '';
  const active    = searchParams.get('active');

  const db = createAdminClient();
  let q = db.from('clients').select('*').order('last_name').order('first_name');

  if (active === 'true') q = q.eq('is_active', true);
  else if (active === 'false') q = q.eq('is_active', false);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filtered in JS (not with `ilike`) so the search ignores accents:
  // "angela" matches "Ángela" and the other way around.
  const clients = search
    ? (data ?? []).filter((c) =>
        matchesTerm(search, c.first_name, c.last_name, `${c.first_name} ${c.last_name}`, c.email, c.phone)
      )
    : data;

  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { first_name, last_name, email, phone, address, notes } = body as Record<string, string>;

  if (!first_name?.trim() || !last_name?.trim() || !phone?.trim() || !address?.trim()) {
    return NextResponse.json({ error: 'first_name, last_name, phone and address are required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('clients')
    .insert({ first_name, last_name, email: email || null, phone, address, notes: notes || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ client: data }, { status: 201 });
}
