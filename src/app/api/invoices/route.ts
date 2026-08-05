import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { InvoiceRow } from '@/types/invoice';

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status   = searchParams.get('status');
  const month    = searchParams.get('month');     // 'YYYY-MM'
  const clientId = searchParams.get('client_id');
  const summary  = searchParams.get('summary');   // '1' → open-invoice counts per client
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit    = 50;

  const db = createAdminClient();

  // Auto-mark pending invoices whose due_date has passed
  const today = new Date().toISOString().slice(0, 10);
  await db.from('invoices').update({ status: 'overdue' }).eq('status', 'pending').lt('due_date', today);

  // Open-invoice counts per client (badges on the clients table). Counted over the
  // whole table — reading the paginated listing would only ever count the first page.
  if (summary) {
    const counts: Record<string, { overdue: number; pending: number }> = {};
    const CHUNK = 1000;
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await db
        .from('invoices')
        .select('status, contracts ( client_id )')
        .in('status', ['overdue', 'pending'])
        .range(from, from + CHUNK - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      for (const inv of data ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cid = (inv.contracts as any)?.client_id as string | undefined;
        if (!cid) continue;
        if (!counts[cid]) counts[cid] = { overdue: 0, pending: 0 };
        if (inv.status === 'overdue') counts[cid].overdue++;
        else counts[cid].pending++;
      }

      if (!data || data.length < CHUNK) break;
    }
    return NextResponse.json({ summary: counts });
  }

  const JOIN = `
    *,
    contracts (
      due_day,
      special_price,
      clients ( id, first_name, last_name, email ),
      service_plans ( name, price, recurrence )
    )
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapRow(inv: any): InvoiceRow {
    const c  = inv.contracts;
    const cl = c?.clients;
    const sp = c?.service_plans;
    return {
      id:              inv.id,
      contract_id:     inv.contract_id,
      reference_month: inv.reference_month,
      due_date:        inv.due_date,
      amount:          Number(inv.amount),
      status:          inv.status,
      notes:           inv.notes,
      issued_at:       inv.issued_at,
      updated_at:      inv.updated_at,
      client_id:       cl?.id ?? '',
      client_name:     cl ? `${cl.first_name} ${cl.last_name}` : '',
      client_email:    cl?.email ?? null,
      plan_name:       sp?.name ?? '',
      plan_recurrence: sp?.recurrence ?? 'monthly',
      due_day:         c?.due_day ?? 10,
    };
  }

  // Client-specific queries (used by the client drawer and payment modals) — no pagination.
  // Filter by the client's contracts in the query itself: filtering afterwards in JS would
  // silently drop the client's older invoices once the table grows past the row limit.
  if (clientId) {
    const { data: contracts, error: cErr } = await db
      .from('contracts')
      .select('id')
      .eq('client_id', clientId);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    const contractIds = (contracts ?? []).map((c: { id: string }) => c.id);
    if (contractIds.length === 0) return NextResponse.json({ invoices: [] });

    let q = db.from('invoices').select(JOIN)
      .in('contract_id', contractIds)
      .order('due_date', { ascending: false })
      .limit(500);
    if (status && status !== 'all') q = q.eq('status', status);
    if (month) q = q.gte('reference_month', `${month}-01`).lte('reference_month', `${month}-31`);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ invoices: (data ?? []).map(mapRow) });
  }

  // Main listing — server-side pagination with count
  let countQ = db.from('invoices').select('id', { count: 'exact', head: true });
  if (status && status !== 'all') countQ = countQ.eq('status', status);
  if (month) countQ = countQ.gte('reference_month', `${month}-01`).lte('reference_month', `${month}-31`);

  let dataQ = db.from('invoices').select(JOIN).order('due_date', { ascending: false }).range((page - 1) * limit, page * limit - 1);
  if (status && status !== 'all') dataQ = dataQ.eq('status', status);
  if (month) dataQ = dataQ.gte('reference_month', `${month}-01`).lte('reference_month', `${month}-31`);

  const [{ count }, { data, error }] = await Promise.all([countQ, dataQ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map(mapRow);
  return NextResponse.json({ invoices: rows, total: count ?? 0, page, limit });
}

/** Generate invoices for a given reference_month (all active contracts or one contract). */
export async function POST(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as Record<string, unknown>;
  const { reference_month, contract_id } = body;

  if (!reference_month) {
    return NextResponse.json({ error: 'reference_month is required (YYYY-MM)' }, { status: 400 });
  }

  // Normalize to first-of-month date string
  const monthStr  = String(reference_month);                  // e.g. '2025-05'
  const refDate   = `${monthStr}-01`;                         // '2025-05-01'
  const [year, month] = monthStr.split('-').map(Number);

  const db = createAdminClient();

  // Load target contracts (active only)
  let contractQ = db
    .from('contracts')
    .select('id, due_day, special_price, service_plans ( price )')
    .eq('status', 'active');
  if (contract_id) contractQ = contractQ.eq('id', contract_id);

  const { data: contracts, error: cErr } = await contractQ;
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contracts?.length) return NextResponse.json({ created: 0, skipped: 0 });

  let created = 0;
  let skipped = 0;

  for (const c of contracts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sp = c.service_plans as any;
    const amount   = c.special_price !== null ? Number(c.special_price) : Number(sp?.price ?? 0);
    const dueDay   = Math.min(c.due_day, new Date(year, month, 0).getDate()); // clamp to last day
    const due_date = `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

    const { error } = await db.from('invoices').insert({
      contract_id: c.id,
      reference_month: refDate,
      due_date,
      amount,
    });

    if (error?.code === '23505') {
      skipped++;  // unique constraint — already exists
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      created++;
    }
  }

  return NextResponse.json({ created, skipped }, { status: 201 });
}
