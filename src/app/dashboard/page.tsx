'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Users, UserPlus, TrendingUp, DollarSign,
  AlertCircle, Clock, FileCheck, RefreshCw,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';
import { KpiCard, KpiSkeleton } from './_components/KpiCard';
import { RevenueChart, RevenueChartSkeleton } from './_components/RevenueChart';
import { StatusBreakdown, StatusBreakdownSkeleton } from './_components/StatusBreakdown';
import { RecentPaymentsCard } from './_components/RecentPaymentsCard';
import { OverdueCard } from './_components/OverdueCard';
import { ClientAlertsTable } from './_components/ClientAlertsTable';
import { RecordPaymentModal } from '@/components/payments/RecordPaymentModal';
import type { DashboardData } from '@/types/dashboard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting(
  phrases: { morning: string; afternoon: string; evening: string },
  name: string | null,
) {
  const h = new Date().getHours();
  const phrase = h < 12 ? phrases.morning : h < 18 ? phrases.afternoon : phrases.evening;
  return `${phrase}${name ? `, ${name.split(' ')[0]}` : ''}`;
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency', currency: 'GTQ', maximumFractionDigits: 0,
  }).format(n);
}

function pctTrend(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

function trendLabel(pct: number, vsLastMonth: string) {
  if (pct === 0) return vsLastMonth;
  return `${pct > 0 ? '+' : ''}${pct}% ${vsLastMonth}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isAuthenticated, authFetch } = useAuth();
  const t = useT();

  const [data, setData]             = useState<DashboardData | null>(null);
  const [fetching, setFetching]     = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [payOpen,      setPayOpen]      = useState(false);
  const [payClientId,  setPayClientId]  = useState('');
  const [payClientName, setPayClientName] = useState('');

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setFetching(true);
    setError(null);

    try {
      const res = await authFetch('/api/dashboard/kpis');
      if (!res.ok) throw new Error('Failed to load dashboard data');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const d = data;
  const revTrend    = d ? pctTrend(d.revenue.currentMonth, d.revenue.lastMonth) : 0;
  const clientTrend = d ? d.clients.newThisMonth - d.clients.newLastMonth : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Page title */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-popover-foreground sm:text-3xl">
            {greeting(t.dashboard, user?.name ?? null)}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          title={t.dashboard.refreshData}
        >
          <RefreshCw className={`h-4 w-4 text-muted ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#cf4528]/30 bg-[#cf4528]/10 px-4 py-3 text-sm text-[#cf4528]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => fetchData()} className="ml-auto underline hover:no-underline">
            {t.common.retry}
          </button>
        </div>
      )}

      {/* ── Client alerts ────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-[#cf4528]/20 bg-popover p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-popover-foreground">{t.dashboard.clientAlertsTitle}</h2>
            <p className="text-xs text-muted">{t.dashboard.clientAlertsSubtitle}</p>
          </div>
          {(d?.clientAlerts.length ?? 0) > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#cf4528] text-xs font-bold text-white">
              {d!.clientAlerts.length}
            </span>
          )}
        </div>
        <ClientAlertsTable
          clients={d?.clientAlerts ?? []}
          loading={fetching}
          onPayment={(id, name) => { setPayClientId(id); setPayClientName(name); setPayOpen(true); }}
        />
      </div>

      {/* ── KPI grid — row 1 (primary) ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {fetching ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              title={t.dashboard.activeClients}
              value={String(d?.clients.active ?? 0)}
              subValue={`${t.dashboard.ofTotal} ${d?.clients.total ?? 0} ${t.dashboard.totalClients}`}
              trend={{ value: clientTrend, label: `${d?.clients.newThisMonth ?? 0} ${t.dashboard.newLabel}` }}
              icon={<Users className="h-5 w-5" />}
              accent="green"
            />
            <KpiCard
              title={t.dashboard.monthlyRecurring}
              value={fmtCurrency(d?.revenue.mrr ?? 0)}
              subValue={`${t.dashboard.from} ${d?.contracts.active ?? 0} ${t.dashboard.activeContracts}`}
              trend={{ value: revTrend, label: trendLabel(revTrend, t.dashboard.vsLastMonth) }}
              icon={<TrendingUp className="h-5 w-5" />}
              accent="orange"
            />
            <KpiCard
              title={t.dashboard.collectedThisMonth}
              value={fmtCurrency(d?.revenue.currentMonth ?? 0)}
              subValue={`${d?.invoices.collectionRate ?? 0}% ${t.dashboard.collectionRate}`}
              trend={{ value: revTrend, label: trendLabel(revTrend, t.dashboard.vsLastMonth) }}
              icon={<DollarSign className="h-5 w-5" />}
              accent="gold"
            />
            <KpiCard
              title={t.dashboard.overdueInvoices}
              value={String(d?.invoices.overdue ?? 0)}
              subValue={d?.invoices.overdueAmount ? `${fmtCurrency(d.invoices.overdueAmount)} ${t.dashboard.outstanding}` : t.dashboard.noOverdueAmount}
              trend={
                (d?.invoices.overdue ?? 0) > 0
                  ? { value: -1, label: t.dashboard.needsAttention }
                  : undefined
              }
              icon={<AlertCircle className="h-5 w-5" />}
              accent="red"
              alert={(d?.invoices.overdue ?? 0) > 0}
            />
          </>
        )}
      </div>

      {/* ── KPI grid — row 2 (secondary) ─────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {fetching ? (
          Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              title={t.dashboard.activeContractsKpi}
              value={String(d?.contracts.active ?? 0)}
              subValue={`${d?.contracts.suspended ?? 0} ${t.dashboard.suspended} · ${d?.contracts.cancelled ?? 0} ${t.dashboard.cancelled}`}
              icon={<FileCheck className="h-5 w-5" />}
              accent="blue"
            />
            <KpiCard
              title={t.dashboard.pendingInvoices}
              value={String(d?.invoices.pending ?? 0)}
              subValue={d?.invoices.pendingAmount ? `${fmtCurrency(d.invoices.pendingAmount)} ${t.dashboard.toCollect}` : t.dashboard.nothingPending}
              icon={<Clock className="h-5 w-5" />}
              accent="orange"
            />
            <KpiCard
              title={t.dashboard.newClients}
              value={String(d?.clients.newThisMonth ?? 0)}
              subValue={`${d?.clients.newLastMonth ?? 0} ${t.dashboard.lastMonth}`}
              trend={{
                value: clientTrend,
                label: `${clientTrend >= 0 ? '+' : ''}${clientTrend} ${t.dashboard.vsLastMonth}`,
              }}
              icon={<UserPlus className="h-5 w-5" />}
              accent="green"
            />
          </>
        )}
      </div>

      {/* ── Charts row ───────────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-popover p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-popover-foreground">{t.dashboard.revenueTitle}</h2>
              <p className="text-xs text-muted">{t.dashboard.revenueSubtitle}</p>
            </div>
            <span className="text-xs text-muted">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} {t.dashboard.highlighted}
            </span>
          </div>
          {fetching || !d ? <RevenueChartSkeleton /> : <RevenueChart data={d.revenue.monthlyTrend} />}
        </div>

        <div className="rounded-2xl border border-border bg-popover p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-semibold text-popover-foreground">{t.dashboard.invoiceStatusTitle}</h2>
            <p className="text-xs text-muted">{t.dashboard.invoiceStatusSubtitle}</p>
          </div>
          {fetching || !d ? <StatusBreakdownSkeleton /> : <StatusBreakdown stats={d.invoices} />}
        </div>
      </div>

      {/* ── Tables row ───────────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-popover p-6">
          <div className="mb-4">
            <h2 className="font-semibold text-popover-foreground">{t.dashboard.recentPaymentsTitle}</h2>
            <p className="text-xs text-muted">{t.dashboard.recentPaymentsSubtitle}</p>
          </div>
          <RecentPaymentsCard payments={d?.recentPayments ?? []} loading={fetching} />
        </div>

        <div className="rounded-2xl border border-[#cf4528]/20 bg-popover p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-popover-foreground">{t.dashboard.overdueTitle}</h2>
              <p className="text-xs text-muted">{t.dashboard.overdueSubtitle}</p>
            </div>
            {(d?.invoices.overdue ?? 0) > 0 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#cf4528] text-xs font-bold text-white">
                {d!.invoices.overdue}
              </span>
            )}
          </div>
          <OverdueCard invoices={d?.overdueInvoices ?? []} loading={fetching} />
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-muted/50">
        Jireh ERP · {t.dashboard.dataNote}: {new Date().toLocaleTimeString()}
      </p>

      <RecordPaymentModal
        clientId={payClientId}
        clientName={payClientName}
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={() => fetchData(true)}
      />
    </div>
  );
}
