import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { ContractRow } from '@/types/contract';

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status    = searchParams.get('status');    // 'active'|'suspended'|'cancelled'|null
  const clientId  = searchParams.get('client_id');

  const db = createAdminClient();
  let q = db
    .from('contracts')
    .select(`
      *,
      clients ( id, first_name, last_name, email ),
      service_plans ( id, name, price, recurrence )
    `)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') q = q.eq('status', status);
  if (clientId) q = q.eq('client_id', clientId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: ContractRow[] = (data ?? []).map((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl = c.clients as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sp = c.service_plans as any;
    return {
      id:              c.id,
      client_id:       c.client_id,
      plan_id:         c.plan_id,
      label:           c.label ?? null,
      special_price:   c.special_price,
      status:          c.status,
      start_date:      c.start_date,
      end_date:        c.end_date,
      due_day:         c.due_day,
      notes:           c.notes,
      created_at:      c.created_at,
      updated_at:      c.updated_at,
      client_name:     `${cl.first_name} ${cl.last_name}`,
      client_email:    cl.email,
      plan_name:       sp.name,
      plan_price:      Number(sp.price),
      plan_recurrence: sp.recurrence,
      effective_price: c.special_price !== null ? Number(c.special_price) : Number(sp.price),
    };
  });

  return NextResponse.json({ contracts: rows });
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as Record<string, unknown>;
  const { client_id, plan_id, label, special_price, due_day, start_date, end_date, notes } = body;

  if (!client_id || !plan_id) {
    return NextResponse.json({ error: 'client_id and plan_id are required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('contracts')
    .insert({
      client_id,
      plan_id,
      label: typeof label === 'string' && label.trim() !== '' ? label.trim() : null,
      special_price: special_price !== undefined && special_price !== '' ? Number(special_price) : null,
      due_day: due_day ? Number(due_day) : 10,
      start_date: start_date || new Date().toISOString().slice(0, 10),
      end_date: end_date || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contract: data }, { status: 201 });
}
