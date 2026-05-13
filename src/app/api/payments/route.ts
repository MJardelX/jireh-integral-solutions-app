import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { PaymentMethod, PaymentRow, NewPaymentItem } from '@/types/payment';

const VALID_METHODS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta_de_credito', 'tarjeta_de_debito'];

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId   = searchParams.get('client_id');
  const clientName = searchParams.get('client_name'); // name search
  const filterDate = searchParams.get('date');         // YYYY-MM-DD exact day
  const filterMonth = searchParams.get('month');       // YYYY-MM
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 50;

  const db = createAdminClient();

  const JOIN = `
    *,
    clients ( first_name, last_name ),
    profiles ( full_name ),
    payment_items ( id )
  `;

  // Resolve client name search to IDs upfront (referenced-table OR filters don't
  // exclude parent rows — they only filter the embedded data, leaving blank names)
  let matchedClientIds: string[] | null = null;
  if (clientName) {
    const term = `%${clientName}%`;
    const { data: matched } = await db
      .from('clients')
      .select('id')
      .or(`first_name.ilike.${term},last_name.ilike.${term}`);
    matchedClientIds = (matched ?? []).map((c: any) => c.id);
    // No clients match → return empty immediately
    if (matchedClientIds.length === 0) {
      return NextResponse.json({ payments: [], total: 0, page, limit });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapRow(p: any): PaymentRow {
    return {
      id:             p.id,
      client_id:      p.client_id,
      total_amount:   Number(p.total_amount),
      payment_method: p.payment_method,
      payment_date:   p.payment_date,
      notes:          p.notes,
      created_by:     p.created_by,
      created_at:     p.created_at,
      client_name:    p.clients ? `${p.clients.first_name} ${p.clients.last_name}` : '',
      recorded_by:    p.profiles?.full_name ?? null,
      invoice_count:  Array.isArray(p.payment_items) ? p.payment_items.length : 0,
    };
  }

  function applyFilters<T extends ReturnType<typeof db.from>>(q: T): T {
    if (clientId)            q = (q as any).eq('client_id', clientId);
    if (filterDate)          q = (q as any).eq('payment_date', filterDate);
    if (filterMonth)         q = (q as any).gte('payment_date', `${filterMonth}-01`).lte('payment_date', `${filterMonth}-31`);
    if (matchedClientIds)    q = (q as any).in('client_id', matchedClientIds);
    return q;
  }

  // Client-specific queries — no pagination
  if (clientId) {
    const { data, error } = await applyFilters(
      db.from('payments').select(JOIN).order('payment_date', { ascending: false }).order('created_at', { ascending: false }).limit(500)
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ payments: (data ?? []).map(mapRow) });
  }

  // Main listing — server-side pagination with count
  const [{ count }, { data, error }] = await Promise.all([
    applyFilters(db.from('payments').select('id', { count: 'exact', head: true })),
    applyFilters(
      db.from('payments').select(JOIN).order('payment_date', { ascending: false }).order('created_at', { ascending: false })
    ).range((page - 1) * limit, page * limit - 1),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: (data ?? []).map(mapRow), total: count ?? 0, page, limit });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const { client_id, total_amount, payment_method, payment_date, notes, items } = body;

  if (!client_id || total_amount === undefined || !payment_method || !payment_date) {
    return NextResponse.json({ error: 'client_id, total_amount, payment_method and payment_date are required' }, { status: 400 });
  }
  if (!VALID_METHODS.includes(payment_method as PaymentMethod)) {
    return NextResponse.json({ error: 'Invalid payment_method' }, { status: 400 });
  }
  const parsedItems = (items as NewPaymentItem[] | undefined) ?? [];

  const db = createAdminClient();

  // Insert payment
  const { data: payment, error: pErr } = await db
    .from('payments')
    .insert({
      client_id,
      total_amount: Number(total_amount),
      payment_method,
      payment_date,
      notes: notes || null,
      created_by: userId,
    })
    .select()
    .single();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Insert payment_items
  if (parsedItems.length > 0) {
    const { error: iErr } = await db.from('payment_items').insert(
      parsedItems.map((item) => ({
        payment_id:     payment.id,
        invoice_id:     item.invoice_id,
        amount_applied: Number(item.amount_applied),
      }))
    );
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    // Mark invoices as paid if fully covered
    for (const item of parsedItems) {
      const { data: inv } = await db
        .from('invoices')
        .select('amount')
        .eq('id', item.invoice_id)
        .single();

      const { data: applied } = await db
        .from('payment_items')
        .select('amount_applied')
        .eq('invoice_id', item.invoice_id);

      const totalApplied = (applied ?? []).reduce((s, r) => s + Number(r.amount_applied), 0);
      if (inv && totalApplied >= Number(inv.amount)) {
        await db.from('invoices').update({ status: 'paid' }).eq('id', item.invoice_id);
      }
    }
  }

  return NextResponse.json({ payment }, { status: 201 });
}
