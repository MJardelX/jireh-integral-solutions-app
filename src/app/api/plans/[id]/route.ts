import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

function requireAdmin(request: NextRequest) {
  if (!request.headers.get('x-user-id')) return 401;
  if (request.headers.get('x-user-role') !== 'admin') return 403;
  return null;
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const err = requireAdmin(request);
  if (err === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (err === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await request.json() as Record<string, unknown>;
  const ALLOWED = ['name', 'description', 'price', 'recurrence', 'is_active'];
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) patch[k] = body[k] === '' ? null : body[k];
  }
  if ('price' in patch) patch['price'] = Number(patch['price']);

  const db = createAdminClient();
  const { data, error } = await db.from('service_plans').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plan: data });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const err = requireAdmin(request);
  if (err === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (err === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const db = createAdminClient();
  // Soft-delete: deactivate rather than hard delete (contracts reference plans)
  const { error } = await db.from('service_plans').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
