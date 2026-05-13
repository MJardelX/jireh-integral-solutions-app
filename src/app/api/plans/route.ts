import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { PlanRecurrence } from '@/types/plan';

const VALID_RECURRENCE: PlanRecurrence[] = ['monthly', 'quarterly', 'semiannual', 'annual'];

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') !== 'all';

  const db = createAdminClient();
  let q = db.from('service_plans').select('*').order('name');
  if (activeOnly) q = q.eq('is_active', true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plans: data });
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (request.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json() as Record<string, unknown>;
  const { name, description, price, recurrence } = body;

  if (!name || price === undefined || !recurrence) {
    return NextResponse.json({ error: 'name, price and recurrence are required' }, { status: 400 });
  }
  if (!VALID_RECURRENCE.includes(recurrence as PlanRecurrence)) {
    return NextResponse.json({ error: 'Invalid recurrence' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('service_plans')
    .insert({ name, description: description || null, price: Number(price), recurrence })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plan: data }, { status: 201 });
}
