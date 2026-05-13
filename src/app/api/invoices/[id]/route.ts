import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { InvoiceStatus } from '@/types/invoice';

type Ctx = { params: Promise<{ id: string }> };

const VALID_STATUS: InvoiceStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;

  const body = await request.json() as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ('status' in body) {
    if (!VALID_STATUS.includes(body['status'] as InvoiceStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    patch['status'] = body['status'];
  }
  if ('notes' in body) patch['notes'] = body['notes'] || null;

  const db = createAdminClient();
  const { data, error } = await db.from('invoices').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invoice: data });
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
  const { error } = await db.from('invoices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
