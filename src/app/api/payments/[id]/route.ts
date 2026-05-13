import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  if (!request.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;

  const db = createAdminClient();
  const { data, error } = await db
    .from('payments')
    .select(`
      *,
      clients ( first_name, last_name ),
      profiles ( full_name ),
      payment_items (
        id,
        invoice_id,
        amount_applied,
        invoices ( reference_month, amount, status )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ payment: data });
}
