'use client';

import { useCallback, useEffect, useState } from 'react';
import { Zap, Database, X, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Paginator } from '@/components/ui/paginator';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';
import type { InvoiceRow, InvoiceStatus } from '@/types/invoice';
import { INVOICE_STATUS_LABELS } from '@/types/invoice';
import type { PaymentMethod } from '@/types/payment';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';

const METHODS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta_de_credito', 'tarjeta_de_debito'];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  overdue:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-border text-muted',
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);
}

function fmtMonth(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function todayYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function InvoicesPage() {
  const t = useT();
  const { user, authFetch } = useAuth();
  const isAdmin = user?.role === 'admin';

  const STATUS_TABS: { value: InvoiceStatus | 'all'; label: string }[] = [
    { value: 'all',       label: t.invoices.tabAll       },
    { value: 'pending',   label: t.invoices.tabPending   },
    { value: 'overdue',   label: t.invoices.tabOverdue   },
    { value: 'paid',      label: t.invoices.tabPaid      },
    { value: 'cancelled', label: t.invoices.tabCancelled },
  ];

  const [invoices,   setInvoices]   = useState<InvoiceRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [statusTab,  setStatusTab]  = useState<InvoiceStatus | 'all'>('all');
  const [month,      setMonth]      = useState('');   // 'YYYY-MM' or ''
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const PAGE_SIZE = 50;

  const [genOpen,    setGenOpen]    = useState(false);
  const [genMonth,   setGenMonth]   = useState(todayYearMonth);
  const [generating, setGenerating] = useState(false);
  const [genResult,  setGenResult]  = useState<{ created: number; skipped: number } | null>(null);
  const [genError,   setGenError]   = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [bfOpen,     setBfOpen]     = useState(false);
  const [bfFrom,     setBfFrom]     = useState(`${currentYear}-01`);
  const [bfTo,       setBfTo]       = useState(todayYearMonth);
  const [backfilling,setBackfilling]= useState(false);
  const [bfResult,   setBfResult]   = useState<{ created: number; skipped: number; months: number } | null>(null);
  const [bfError,    setBfError]    = useState<string | null>(null);

  const [payInvoice, setPayInvoice] = useState<InvoiceRow | null>(null);
  const [payMethod,  setPayMethod]  = useState<PaymentMethod>('efectivo');
  const [payDate,    setPayDate]    = useState(new Date().toISOString().slice(0, 10));
  const [payNotes,   setPayNotes]   = useState('');
  const [paying,     setPaying]     = useState(false);
  const [payError,   setPayError]   = useState<string | null>(null);

  const load = useCallback(async (status: InvoiceStatus | 'all' = statusTab, m = month, p = page) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (status !== 'all') params.set('status', status);
      if (m) params.set('month', m);
      const res = await authFetch(`/api/invoices?${params}`);
      if (!res.ok) throw new Error('Failed to load invoices');
      const { invoices: data, total: tot } = await res.json();
      setInvoices(data);
      if (tot !== undefined) setTotal(tot);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [authFetch, statusTab, month, page]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus(id: string, status: InvoiceStatus) {
    await authFetch(`/api/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await load(statusTab, month);
  }

  async function deleteInvoice(id: string) {
    if (!confirm('Delete this invoice?')) return;
    await authFetch(`/api/invoices/${id}`, { method: 'DELETE' });
    await load(statusTab, month);
  }

  function openPayModal(inv: InvoiceRow) {
    setPayInvoice(inv);
    setPayMethod('efectivo');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNotes('');
    setPayError(null);
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!payInvoice) return;
    setPaying(true); setPayError(null);
    try {
      const res = await authFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          client_id:      payInvoice.client_id,
          total_amount:   payInvoice.amount,
          payment_method: payMethod,
          payment_date:   payDate,
          notes:          payNotes,
          items: [{ invoice_id: payInvoice.id, amount_applied: payInvoice.amount }],
        }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setPayInvoice(null);
      await load(statusTab, month);
    } catch (e) { setPayError(e instanceof Error ? e.message : 'Error'); }
    finally { setPaying(false); }
  }

  async function handleBackfill(e: React.FormEvent) {
    e.preventDefault();
    setBackfilling(true); setBfError(null); setBfResult(null);
    try {
      const res = await authFetch('/api/invoices/backfill', {
        method: 'POST',
        body: JSON.stringify({ from_month: bfFrom, to_month: bfTo }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      const result = await res.json();
      setBfResult(result);
      await load(statusTab, month);
    } catch (e) { setBfError(e instanceof Error ? e.message : 'Error'); }
    finally { setBackfilling(false); }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true); setGenError(null); setGenResult(null);
    try {
      const res = await authFetch('/api/invoices', { method: 'POST', body: JSON.stringify({ reference_month: genMonth }) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      const result = await res.json();
      setGenResult(result);
      await load(statusTab, month);
    } catch (e) { setGenError(e instanceof Error ? e.message : 'Error'); }
    finally { setGenerating(false); }
  }

  const canGenerate  = genMonth !== '';
  const canBackfill  = bfFrom !== '' && bfTo !== '' && bfFrom <= bfTo;
  const canPay       = payDate !== '';

  const colHeaders = [t.invoices.colClient, t.invoices.colPlan, t.invoices.colMonth, t.invoices.colDueDate, t.invoices.colAmount, t.invoices.colStatus, ''];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-popover-foreground">{t.invoices.title}</h1>
          <p className="mt-0.5 text-sm text-muted">{total} {t.common.total}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="ghost" onClick={() => { setBfOpen(true); setBfResult(null); setBfError(null); }} className="gap-2 border border-border">
              <Database className="h-4 w-4" /> {t.invoices.backfillBtn}
            </Button>
          )}
          <Button onClick={() => { setGenOpen(true); setGenResult(null); setGenError(null); }} className="gap-2">
            <Zap className="h-4 w-4" /> {t.invoices.generateBtn}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-border bg-background/40 p-1">
          {STATUS_TABS.map((tab) => (
            <button key={tab.value} onClick={() => { setStatusTab(tab.value); setPage(1); load(tab.value, month, 1); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${statusTab === tab.value ? 'bg-popover text-popover-foreground shadow-sm' : 'text-muted hover:text-popover-foreground'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">{t.invoices.monthFilter}</label>
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); load(statusTab, e.target.value, 1); }}
            className="rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-popover-foreground outline-none focus:border-primary" />
          {month && <button onClick={() => { setMonth(''); setPage(1); load(statusTab, '', 1); }} className="text-xs text-muted hover:text-popover-foreground">{t.invoices.clearFilter}</button>}
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-border bg-popover">
        {loading ? (
          <InvoicesTableSkeleton colHeaders={colHeaders} />
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted">{t.invoices.noInvoices}</div>
        ) : (
          <>
            {/* ── Mobile: card list ─────────────────────────────────────── */}
            <ul className="divide-y divide-border sm:hidden">
              {invoices.map((inv) => (
                <li key={inv.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-popover-foreground truncate">{inv.client_name}</span>
                        <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">{inv.plan_name} · {fmtMonth(inv.reference_month)}</p>
                      <p className="mt-0.5 text-sm">
                        <span className="font-medium text-popover-foreground">{fmtCurrency(inv.amount)}</span>
                        <span className="ml-2 text-xs text-muted">due {new Date(inv.due_date + 'T00:00:00').toLocaleDateString()}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                        <button onClick={() => openPayModal(inv)} title={t.invoices.actionMarkPaid}
                          className="rounded-md p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {inv.status === 'pending' && (
                        <button onClick={() => changeStatus(inv.id, 'overdue')} title={t.invoices.actionMarkOverdue}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20">
                          <AlertCircle className="h-4 w-4" />
                        </button>
                      )}
                      {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                        <button onClick={() => changeStatus(inv.id, 'cancelled')} title={t.invoices.actionCancel}
                          className="rounded-md p-1.5 text-muted hover:bg-border/60">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => deleteInvoice(inv.id)} className="rounded-md px-1.5 py-1 text-xs text-destructive hover:bg-destructive/10">{t.invoices.actionDelete}</button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* ── Desktop: table ────────────────────────────────────────── */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="border-b border-border bg-background/40">
                <tr>
                  {colHeaders.map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-border/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-popover-foreground">{inv.client_name}</td>
                    <td className="px-4 py-3 text-muted">{inv.plan_name}</td>
                    <td className="px-4 py-3 text-muted">{fmtMonth(inv.reference_month)}</td>
                    <td className="px-4 py-3 text-muted">{new Date(inv.due_date + 'T00:00:00').toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-popover-foreground">{fmtCurrency(inv.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button onClick={() => openPayModal(inv)} title={t.invoices.actionMarkPaid}
                            className="rounded-md p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20">
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {inv.status === 'pending' && (
                          <button onClick={() => changeStatus(inv.id, 'overdue')} title={t.invoices.actionMarkOverdue}
                            className="rounded-md p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20">
                            <AlertCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                          <button onClick={() => changeStatus(inv.id, 'cancelled')} title={t.invoices.actionCancel}
                            className="rounded-md p-1.5 text-muted hover:bg-border/60">
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => deleteInvoice(inv.id)} className="rounded-md px-1.5 py-1 text-xs text-destructive hover:bg-destructive/10">{t.invoices.actionDelete}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <Paginator
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={(p) => { setPage(p); load(statusTab, month, p); }}
      />

      {/* Quick-pay modal */}
      {payInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-popover-foreground">{t.invoices.recordPaymentTitle}</h2>
              <button onClick={() => setPayInvoice(null)} className="rounded-md p-1 text-muted hover:text-popover-foreground"><X className="h-4 w-4" /></button>
            </div>

            {/* Invoice summary */}
            <div className="mb-4 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm">
              <div className="font-medium text-popover-foreground">{payInvoice.client_name}</div>
              <div className="mt-0.5 text-muted">{payInvoice.plan_name} · {fmtMonth(payInvoice.reference_month)}</div>
              <div className="mt-1 text-base font-semibold text-[#7f9d32]">{fmtCurrency(payInvoice.amount)}</div>
            </div>

            <form onSubmit={handlePay} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.invoices.colAmount}</label>
                  <input disabled value={fmtCurrency(payInvoice.amount)}
                    className="w-full rounded-lg border border-border bg-border/20 px-3 py-2 text-sm text-muted outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.common.date} *</label>
                  <input required type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.payments.methodLabel} *</label>
                <select required value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15">
                  {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.common.notes}</label>
                <textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
              </div>
              {payError && <p className="text-sm text-destructive">{payError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setPayInvoice(null)}>{t.common.cancel}</Button>
                <Button type="submit" disabled={paying || !canPay}>{paying ? t.common.saving : t.invoices.confirmPayment}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backfill modal */}
      {bfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-popover-foreground">{t.invoices.backfillTitle}</h2>
              <button onClick={() => setBfOpen(false)} className="rounded-md p-1 text-muted hover:text-popover-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-4 text-sm text-muted">{t.invoices.backfillDesc}</p>
            <form onSubmit={handleBackfill} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.invoices.fromMonth} *</label>
                  <input type="month" required value={bfFrom} onChange={(e) => setBfFrom(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.invoices.toMonth} *</label>
                  <input type="month" required value={bfTo} onChange={(e) => setBfTo(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
                </div>
              </div>
              {bfResult && (
                <div className="rounded-xl bg-green-100 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ✓ {bfResult.created} {t.invoices.invoicesCreated}
                  {bfResult.skipped > 0 && `, ${bfResult.skipped} ${t.invoices.skipped}`}
                  {` ${t.invoices.months.replace('month(s)', String(bfResult.months))}`}
                </div>
              )}
              {bfError && <p className="text-sm text-destructive">{bfError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setBfOpen(false)}>{t.common.cancel}</Button>
                <Button type="submit" disabled={backfilling || !canBackfill}>{backfilling ? t.invoices.running : t.invoices.runBackfill}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate modal */}
      {genOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-popover-foreground">{t.invoices.generateTitle}</h2>
              <button onClick={() => setGenOpen(false)} className="rounded-md p-1 text-muted hover:text-popover-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-4 text-sm text-muted">{t.invoices.generateDesc}</p>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.invoices.referenceMonth} *</label>
                <input type="month" required value={genMonth} onChange={(e) => setGenMonth(e.target.value)}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
              </div>
              {genResult && (
                <div className="rounded-xl bg-green-100 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ✓ {genResult.created} {t.invoices.created}
                  {genResult.skipped > 0 && `, ${genResult.skipped} ${t.invoices.skipped}`}
                </div>
              )}
              {genError && <p className="text-sm text-destructive">{genError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setGenOpen(false)}>{t.common.cancel}</Button>
                <Button type="submit" disabled={generating || !canGenerate}>{generating ? t.invoices.generating : t.invoices.generate}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const SK = [
  { client: 'w-32', plan: 'w-36', amount: 'w-16' },
  { client: 'w-44', plan: 'w-28', amount: 'w-14' },
  { client: 'w-28', plan: 'w-44', amount: 'w-16' },
  { client: 'w-36', plan: 'w-32', amount: 'w-12' },
  { client: 'w-40', plan: 'w-36', amount: 'w-16' },
  { client: 'w-24', plan: 'w-40', amount: 'w-14' },
];

function InvoicesTableSkeleton({ colHeaders }: { colHeaders: string[] }) {
  return (
    <>
      {/* Mobile */}
      <ul className="divide-y divide-border sm:hidden">
        {SK.map((w, i) => (
          <li key={i} className="px-4 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`skeleton h-4 rounded ${w.client}`} />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <div className={`skeleton h-3 rounded ${w.plan}`} />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <div className={`skeleton h-4 rounded ${w.amount}`} />
              <div className="skeleton h-3 w-20 rounded" />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop */}
      <table className="hidden w-full text-sm sm:table">
        <thead className="border-b border-border bg-background/40">
          <tr>
            {colHeaders.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {SK.map((w, i) => (
            <tr key={i}>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.client}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.plan}`} /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.amount}`} /></td>
              <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <div className="skeleton h-7 w-7 rounded-md" />
                  <div className="skeleton h-7 w-7 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
