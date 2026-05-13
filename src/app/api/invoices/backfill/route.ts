import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ey, em] = to.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as Record<string, unknown>;
  const from_month = String(body.from_month ?? '');
  const to_month   = String(body.to_month   ?? '');

  if (!from_month.match(/^\d{4}-\d{2}$/) || !to_month.match(/^\d{4}-\d{2}$/)) {
    return NextResponse.json({ error: 'from_month and to_month required (YYYY-MM)' }, { status: 400 });
  }
  if (from_month > to_month) {
    return NextResponse.json({ error: 'from_month must be before to_month' }, { status: 400 });
  }

  const db = createAdminClient();

  // Load all contracts (any status) with their plan price
  const { data: contracts, error: cErr } = await db
    .from('contracts')
    .select('id, due_day, special_price, start_date, end_date, status, service_plans ( price )');

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const months = monthRange(from_month, to_month);
  let created = 0;
  let skipped = 0;

  for (const monthStr of months) {
    const [year, month] = monthStr.split('-').map(Number);
    const refDate        = `${monthStr}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const lastDate       = `${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`;

    for (const c of contracts ?? []) {
      // Skip if contract hadn't started yet this month
      if (c.start_date > lastDate) continue;
      // Skip if contract ended before this month started
      if (c.end_date && c.end_date < refDate) continue;
      // Skip cancelled contracts
      if (c.status === 'cancelled') continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sp       = c.service_plans as any;
      const amount   = c.special_price !== null ? Number(c.special_price) : Number(sp?.price ?? 0);
      const dueDay   = Math.min(c.due_day, lastDayOfMonth);
      const due_date = `${monthStr}-${String(dueDay).padStart(2, '0')}`;

      const { error } = await db.from('invoices').insert({
        contract_id:     c.id,
        reference_month: refDate,
        due_date,
        amount,
      });

      if (error?.code === '23505') skipped++;
      else if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      else created++;
    }
  }

  return NextResponse.json({ created, skipped, months: months.length });
}
