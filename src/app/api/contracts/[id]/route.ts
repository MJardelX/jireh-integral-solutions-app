import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { ContractStatus } from '@/types/contract';

type Ctx = { params: Promise<{ id: string }> };

const VALID_STATUS: ContractStatus[] = ['active', 'suspended', 'cancelled'];

export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;

  const body = await request.json() as Record<string, unknown>;
  const ALLOWED = ['status', 'special_price', 'due_day', 'end_date', 'notes'];
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) patch[k] = body[k] === '' ? null : body[k];
  }
  if ('status' in patch && !VALID_STATUS.includes(patch['status'] as ContractStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if ('special_price' in patch && patch['special_price'] !== null) {
    patch['special_price'] = Number(patch['special_price']);
  }

  const db = createAdminClient();
  const { data, error } = await db.from('contracts').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contract: data });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (request.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;

  const db = createAdminClient();
  const { error } = await db.from('contracts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
