/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { DashboardData, MonthlyPoint, ClientAlert } from '@/types/dashboard';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();

  // Date helpers
  const now              = new Date();
  const firstOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentMonthStr  = firstOfMonth.toISOString().split('T')[0];
  const lastMonthStr     = firstOfLastMonth.toISOString().split('T')[0];
  const nextMonthStr     = firstOfNextMonth.toISOString().split('T')[0];

  // Year for the trend chart (defaults to current year)
  const { searchParams } = new URL(request.url);
  const trendYear      = Math.max(2020, parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10));
  const trendYearStart = `${trendYear}-01-01`;
  const trendYearEnd   = `${trendYear + 1}-01-01`;

  // Run all queries in parallel
  const [
    { count: totalClients },
    { count: activeClients },
    { count: newThisMonth },
    { count: newLastMonth },
    { count: activeContracts },
    { count: suspendedContracts },
    { count: cancelledContracts },
    { data: contractPrices },
    { data: currentMonthInvoices },
    { data: currentMonthPayments },
    { data: lastMonthPayments },
    { data: trendPayments },
    { data: recentPaymentsRaw },
    { data: overdueRaw },
    { data: clientPaymentsRaw },
  ] = await Promise.all([
    db.from('clients').select('*', { count: 'exact', head: true }),
    db.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true),
    db.from('clients').select('*', { count: 'exact', head: true })
      .gte('created_at', firstOfMonth.toISOString()),
    db.from('clients').select('*', { count: 'exact', head: true })
      .gte('created_at', firstOfLastMonth.toISOString())
      .lt('created_at', firstOfMonth.toISOString()),

    db.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
    db.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),

    // MRR: effective price for each active contract
    db.from('contracts')
      .select('special_price, service_plans(price)')
      .eq('status', 'active'),

    // Current month invoices (for invoice status chart only)
    db.from('invoices')
      .select('status, amount')
      .eq('reference_month', currentMonthStr),

    // Payments received this month (real cash collected)
    db.from('payments')
      .select('total_amount')
      .gte('payment_date', currentMonthStr)
      .lt('payment_date', nextMonthStr),

    // Payments received last month (for trend comparison)
    db.from('payments')
      .select('total_amount')
      .gte('payment_date', lastMonthStr)
      .lt('payment_date', currentMonthStr),

    // Full-year payments trend for selected year
    db.from('payments')
      .select('payment_date, total_amount')
      .gte('payment_date', trendYearStart)
      .lt('payment_date', trendYearEnd),

    // Recent payments with client name
    db.from('payments')
      .select('id, total_amount, payment_method, payment_date, clients(first_name, last_name)')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),

    // Overdue invoices with client + plan name (no limit — used for both detail table and client grouping)
    db.from('invoices')
      .select('id, amount, due_date, contracts(client_id, clients(first_name, last_name), service_plans(name))')
      .eq('status', 'overdue')
      .order('due_date', { ascending: true }),

    // Last payments per client (for client alert rows)
    db.from('payments')
      .select('client_id, total_amount, payment_date')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  // ── MRR ──────────────────────────────────────────────────────────────────
  const mrr = (contractPrices ?? []).reduce((sum, c: any) => {
    return sum + Number(c.special_price ?? c.service_plans?.price ?? 0);
  }, 0);

  // ── Invoice stats (current month) ─────────────────────────────────────────
  const stats = { paid: 0, pending: 0, overdue: 0, cancelled: 0,
                   paidAmount: 0, pendingAmount: 0, overdueAmount: 0 };

  for (const inv of currentMonthInvoices ?? []) {
    const amt = Number(inv.amount);
    if (inv.status === 'paid')      { stats.paid++;       stats.paidAmount      += amt; }
    if (inv.status === 'pending')   { stats.pending++;    stats.pendingAmount   += amt; }
    if (inv.status === 'overdue')   { stats.overdue++;    stats.overdueAmount   += amt; }
    if (inv.status === 'cancelled') { stats.cancelled++;                                }
  }

  const billable = stats.paidAmount + stats.pendingAmount + stats.overdueAmount;
  const collectionRate = billable > 0 ? (stats.paidAmount / billable) * 100 : 0;

  // Revenue = actual payments received (not invoice amounts)
  const currentMonthRevenue = (currentMonthPayments ?? [])
    .reduce((s: number, p: any) => s + Number(p.total_amount), 0);
  const lastMonthRevenue = (lastMonthPayments ?? [])
    .reduce((s: number, p: any) => s + Number(p.total_amount), 0);

  // ── Annual trend (12 months of actual payments received) ────────────────────
  const monthMap = new Map<string, number>();
  for (const p of trendPayments ?? []) {
    const key = (p.payment_date as string).substring(0, 7);
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(p.total_amount));
  }

  const monthlyTrend: MonthlyPoint[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(trendYear, i, 1);
    const key = `${trendYear}-${String(i + 1).padStart(2, '0')}`;
    return {
      month: key,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      amount: monthMap.get(key) ?? 0,
    };
  });

  // ── Recent payments ───────────────────────────────────────────────────────
  const recentPayments = (recentPaymentsRaw ?? []).map((p: any) => ({
    id: p.id,
    clientName: `${p.clients?.first_name ?? ''} ${p.clients?.last_name ?? ''}`.trim() || '—',
    amount: Number(p.total_amount),
    method: p.payment_method,
    date: p.payment_date,
  }));

  // ── Overdue invoices ───────────────────────────────────────────────────────
  const overdueInvoices = (overdueRaw ?? []).map((inv: any) => {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.max(
      Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000),
      0
    );
    return {
      id: inv.id,
      clientName: `${inv.contracts?.clients?.first_name ?? ''} ${inv.contracts?.clients?.last_name ?? ''}`.trim() || '—',
      planName: inv.contracts?.service_plans?.name ?? '—',
      amount: Number(inv.amount),
      dueDate: inv.due_date,
      daysOverdue,
    };
  });

  // ── Client alerts (per-client overdue summary + last payment) ─────────────
  type AlertEntry = ClientAlert;
  const clientAlertsMap = new Map<string, AlertEntry>();

  for (const inv of overdueRaw ?? []) {
    const clientId = String((inv.contracts as any)?.client_id ?? '');
    if (!clientId) continue;
    const c = (inv.contracts as any)?.clients;
    const clientName = `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim() || '—';
    const amount = Number(inv.amount);
    const daysOverdue = Math.max(
      Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86_400_000),
      0
    );
    const existing = clientAlertsMap.get(clientId);
    if (existing) {
      existing.overdueCount++;
      existing.overdueAmount += amount;
      existing.mostDaysOverdue = Math.max(existing.mostDaysOverdue, daysOverdue);
    } else {
      clientAlertsMap.set(clientId, {
        clientId, clientName,
        overdueCount: 1, overdueAmount: amount, mostDaysOverdue: daysOverdue,
        lastPaymentDate: null, lastPaymentAmount: null,
      });
    }
  }

  const seenPaymentClients = new Set<string>();
  for (const p of clientPaymentsRaw ?? []) {
    const clientId = String((p as any).client_id ?? '');
    if (!clientId || seenPaymentClients.has(clientId)) continue;
    seenPaymentClients.add(clientId);
    const alert = clientAlertsMap.get(clientId);
    if (alert) {
      alert.lastPaymentDate = (p as any).payment_date;
      alert.lastPaymentAmount = Number((p as any).total_amount);
    }
  }

  const clientAlerts: ClientAlert[] = Array.from(clientAlertsMap.values())
    .sort((a, b) => b.mostDaysOverdue - a.mostDaysOverdue);

  const payload: DashboardData = {
    clients: {
      total: totalClients ?? 0,
      active: activeClients ?? 0,
      newThisMonth: newThisMonth ?? 0,
      newLastMonth: newLastMonth ?? 0,
    },
    revenue: {
      currentMonth: currentMonthRevenue,
      lastMonth: lastMonthRevenue,
      mrr,
      monthlyTrend,
    },
    invoices: {
      ...stats,
      collectionRate: Math.round(collectionRate * 10) / 10,
    },
    contracts: {
      active: activeContracts ?? 0,
      suspended: suspendedContracts ?? 0,
      cancelled: cancelledContracts ?? 0,
    },
    recentPayments,
    overdueInvoices,
    clientAlerts,
  };

  return NextResponse.json(payload);
}
