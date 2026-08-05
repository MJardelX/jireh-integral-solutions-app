'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X, Pencil, CreditCard, AlertTriangle, CheckCircle, FileDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';
import { RecordPaymentModal } from '@/components/payments/RecordPaymentModal';
import { generarReciboPDF } from '@/lib/utils';
import { contractLabels, reciboPeriodos } from '@/lib/contracts';
import type { Client } from '@/types/client';
import type { InvoiceRow, InvoiceStatus } from '@/types/invoice';
import type { PaymentRow } from '@/types/payment';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fullName(c: Client) { return `${c.first_name} ${c.last_name}`; }

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMonth(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-GT', { month: 'short', year: 'numeric' });
}

/** Which plan/contract each invoice covered by a payment belongs to. */
function PeriodTags({ payment, className = '' }: { payment: PaymentRow; className?: string }) {
  if (payment.periods.length === 0) return null;
  const labels = contractLabels(payment.periods);
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {payment.periods.map((p, i) => (
        <span key={i} className="rounded bg-border/60 px-1.5 py-0.5 text-xs text-muted">
          <span className="text-popover-foreground">{labels[p.contract_id] || '—'}</span>
          {' · '}{fmtMonth(p.reference_month)}
        </span>
      ))}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function InvoiceStatusBadge({ status, t }: { status: InvoiceStatus; t: ReturnType<typeof useT> }) {
  const map: Record<InvoiceStatus, string> = {
    paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    overdue:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-border text-muted',
  };
  const labels: Record<InvoiceStatus, string> = {
    paid:      t.invoices.statusPaid,
    pending:   t.invoices.statusPending,
    overdue:   t.invoices.statusOverdue,
    cancelled: t.invoices.statusCancelled,
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? map.pending}`}>
      {labels[status]}
    </span>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DrawerTab = 'invoices' | 'payments';
type InvoiceFilter = 'all' | InvoiceStatus;

const EMPTY_FORM = {
  first_name: '', last_name: '', phone: '', email: '', address: '', notes: '',
};

const INPUT_CLS =
  'w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15 dark:focus:border-primary';

// ─── Component ────────────────────────────────────────────────────────────────

export interface ClientDrawerProps {
  client: Client | null;
  open: boolean;
  onClose: () => void;
  onClientUpdated: () => void;
}

export function ClientDrawer({ client, open, onClose, onClientUpdated }: ClientDrawerProps) {
  const t = useT();
  const { authFetch } = useAuth();

  const [activeTab,       setActiveTab]       = useState<DrawerTab>('invoices');
  const [invoices,        setInvoices]        = useState<InvoiceRow[]>([]);
  const [payments,        setPayments]        = useState<PaymentRow[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [invFilter,       setInvFilter]       = useState<InvoiceFilter>('all');
  const [payMonth,        setPayMonth]        = useState<string>('all');

  // edit form
  const [editOpen,   setEditOpen]   = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);

  // payment modal
  const [payOpen, setPayOpen] = useState(false);

  // cut service
  const [showCutConfirm, setShowCutConfirm] = useState(false);
  const [cuttingService, setCuttingService] = useState(false);
  const [cutDone,        setCutDone]        = useState(false);

  // pdf download
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!client) return;
    setLoadingInvoices(true);
    setLoadingPayments(true);
    try {
      const [invRes, payRes] = await Promise.all([
        authFetch(`/api/invoices?client_id=${client.id}`),
        authFetch(`/api/payments?client_id=${client.id}`),
      ]);
      const { invoices: invData = [] } = await invRes.json();
      const { payments: payData = [] } = await payRes.json();
      setInvoices(invData);
      setPayments(payData);
    } finally {
      setLoadingInvoices(false);
      setLoadingPayments(false);
    }
  }, [client, authFetch]);

  useEffect(() => {
    if (open && client) {
      setActiveTab('invoices');
      setInvFilter('all');
      setPayMonth('all');
      setShowCutConfirm(false);
      setCutDone(false);
      fetchData();
    }
  }, [open, client]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side filtered data
  const filteredInvoices = invFilter === 'all'
    ? invoices
    : invoices.filter((i) => i.status === invFilter);

  const filteredPayments = payMonth === 'all'
    ? payments
    : payments.filter((p) => p.payment_date.startsWith(payMonth));

  const paymentMonths = Array.from(
    new Set(payments.map((p) => p.payment_date.substring(0, 7)))
  ).sort().reverse();

  function openEdit() {
    if (!client) return;
    setForm({
      first_name: client.first_name,
      last_name:  client.last_name,
      phone:      client.phone,
      email:      client.email ?? '',
      address:    client.address,
      notes:      client.notes ?? '',
    });
    setFormError(null);
    setEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await authFetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setEditOpen(false);
      onClientUpdated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function cutService() {
    if (!client) return;
    setCuttingService(true);
    try {
      const res = await authFetch(`/api/contracts?client_id=${client.id}&status=active`);
      const { contracts = [] } = await res.json();
      if (contracts.length === 0) {
        setShowCutConfirm(false);
        setCutDone(true);
        return;
      }
      await Promise.all(
        contracts.map((c: { id: string }) =>
          authFetch(`/api/contracts/${c.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'suspended' }),
          })
        )
      );
      setShowCutConfirm(false);
      setCutDone(true);
      onClientUpdated();
      await fetchData();
    } finally {
      setCuttingService(false);
    }
  }

  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;

  const canSubmit =
    form.first_name.trim() !== '' &&
    form.last_name.trim() !== '' &&
    form.phone.trim() !== '' &&
    form.address.trim() !== '';

  const INVOICE_FILTERS: { value: InvoiceFilter; label: string }[] = [
    { value: 'all',       label: t.clients.drawerFilterAll },
    { value: 'overdue',   label: t.invoices.statusOverdue },
    { value: 'pending',   label: t.invoices.statusPending },
    { value: 'paid',      label: t.invoices.statusPaid },
    { value: 'cancelled', label: t.invoices.statusCancelled },
  ];

  if (!client) return null;

  const name = fullName(client);

  return (
    <>
      {/* Overlay */}
      <div
        className={[
          'fixed inset-0 z-[200] bg-black/40 lg:bg-black/20 transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside
        className={[
          'fixed inset-y-0 right-0 z-[210] flex w-full flex-col border-l border-border bg-popover shadow-2xl transition-transform duration-300 sm:w-[480px]',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-popover-foreground">{name}</h2>
              <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                client.is_active
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-border text-muted'
              }`}>
                {client.is_active ? t.common.active : t.common.inactive}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {client.phone}{client.email ? ` · ${client.email}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={openEdit}
              className="rounded-md p-1.5 text-muted hover:bg-border/60 hover:text-popover-foreground"
              title={t.common.edit}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted hover:bg-border/60 hover:text-popover-foreground"
              title={t.common.close}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── CTA bar ────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-2" onClick={() => { setPayOpen(true); onClose(); }}>
              <CreditCard className="h-4 w-4" />
              {t.clients.drawerRecordPayment}
            </Button>

            {overdueCount >= 3 && !cutDone && (
              <Button
                variant="outline"
                className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                onClick={() => setShowCutConfirm((v) => !v)}
              >
                <AlertTriangle className="h-4 w-4" />
                {t.clients.cutService}
              </Button>
            )}

            {cutDone && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                {t.clients.cutServiceDone}
              </span>
            )}
          </div>

          {/* Inline confirmation */}
          {showCutConfirm && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                {overdueCount} {t.clients.cutServiceWarning}
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mb-3">{t.clients.cutServiceDesc}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                  disabled={cuttingService}
                  onClick={cutService}
                >
                  {cuttingService ? '…' : t.clients.cutServiceConfirm}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={cuttingService}
                  onClick={() => setShowCutConfirm(false)}
                >
                  {t.clients.cutServiceCancel}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div className="shrink-0 flex border-b border-border px-5">
          {(['invoices', 'payments'] as DrawerTab[]).map((tab) => {
            const label = tab === 'invoices'
              ? t.clients.drawerInvoicesTab
              : t.clients.drawerPaymentsTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'relative mr-6 py-3 px-1 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-primary'
                    : 'text-muted hover:text-popover-foreground',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Scrollable content ─────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* Facturas tab */}
          {activeTab === 'invoices' && (
            <>
              <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-3">
                {INVOICE_FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setInvFilter(value)}
                    className={[
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      invFilter === value
                        ? 'bg-primary text-white'
                        : 'bg-border/50 text-muted hover:bg-border hover:text-popover-foreground',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loadingInvoices ? (
                <InvoicesSkeleton />
              ) : filteredInvoices.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">{t.clients.drawerNoInvoices}</p>
              ) : (
                <>
                  {/* Mobile: card list */}
                  <ul className="divide-y divide-border sm:hidden">
                    {filteredInvoices.map((inv) => {
                      const daysOverdue = inv.status === 'overdue'
                        ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86_400_000))
                        : null;
                      return (
                        <li key={inv.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-popover-foreground">{fmtMonth(inv.reference_month)}</span>
                                <InvoiceStatusBadge status={inv.status} t={t} />
                              </div>
                              <p className="mt-0.5 text-sm text-muted">
                                {fmtCurrency(inv.amount)} · {t.clients.drawerColDue} {fmtDate(inv.due_date)}
                              </p>
                              {daysOverdue !== null && (
                                <p className="mt-0.5 text-xs text-red-500">{daysOverdue}{t.clients.drawerDaysOverdue}</p>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Desktop: table */}
                  <table className="hidden w-full text-sm sm:table">
                    <thead className="sticky top-0 border-b border-border bg-popover">
                      <tr>
                        {[t.clients.drawerColPeriod, t.common.amount, t.clients.drawerColDue, t.common.status].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredInvoices.map((inv) => {
                        const daysOverdue = inv.status === 'overdue'
                          ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86_400_000))
                          : null;
                        return (
                          <tr key={inv.id} className="transition-colors hover:bg-border/20">
                            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-popover-foreground">
                              {fmtMonth(inv.reference_month)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtCurrency(inv.amount)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(inv.due_date)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col gap-0.5">
                                <InvoiceStatusBadge status={inv.status} t={t} />
                                {daysOverdue !== null && (
                                  <span className="text-xs text-red-500">{daysOverdue}{t.clients.drawerDaysOverdue}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}

          {/* Pagos tab */}
          {activeTab === 'payments' && (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="text-xs font-medium text-muted">{t.clients.drawerFilterMonth}</span>
                <select
                  value={payMonth}
                  onChange={(e) => setPayMonth(e.target.value)}
                  className="rounded-lg border border-border bg-input px-2 py-1 text-xs text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15"
                >
                  <option value="all">{t.clients.drawerAllMonths}</option>
                  {paymentMonths.map((m) => (
                    <option key={m} value={m}>{fmtMonth(m + '-01')}</option>
                  ))}
                </select>
              </div>

              {loadingPayments ? (
                <PaymentsSkeleton />
              ) : filteredPayments.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">{t.clients.drawerNoPayments}</p>
              ) : (
                <>
                  {/* Mobile: card list */}
                  <ul className="divide-y divide-border sm:hidden">
                    {filteredPayments.map((p) => (
                      <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-popover-foreground">{fmtDate(p.payment_date)}</span>
                            <span className="text-sm font-semibold text-primary">{fmtCurrency(p.total_amount)}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-muted">{PAYMENT_METHOD_LABELS[p.payment_method]}</p>
                          <PeriodTags payment={p} className="mt-1" />
                        </div>
                        <button
                          title="Descargar recibo"
                          disabled={downloadingId === p.id}
                          onClick={async () => {
                            setDownloadingId(p.id);
                            try {
                              await generarReciboPDF({
                                cliente: name,
                                monto: p.total_amount,
                                metodo: PAYMENT_METHOD_LABELS[p.payment_method],
                                fecha: p.payment_date,
                                notas: p.notes ?? undefined,
                                id: p.id,
                                periodos: reciboPeriodos(p),
                              });
                            } finally {
                              setDownloadingId(null);
                            }
                          }}
                          className="shrink-0 rounded p-1.5 text-muted hover:text-primary disabled:opacity-40"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Desktop: table */}
                  <table className="hidden w-full text-sm sm:table">
                    <thead className="sticky top-0 border-b border-border bg-popover">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t.common.date}</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t.clients.drawerColMethod}</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t.common.amount}</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">{t.clients.drawerColPeriods}</th>
                        <th className="px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="transition-colors hover:bg-border/20">
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-popover-foreground">
                            {fmtDate(p.payment_date)}
                          </td>
                          <td className="px-4 py-2.5 text-muted">{PAYMENT_METHOD_LABELS[p.payment_method]}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtCurrency(p.total_amount)}</td>
                          <td className="px-4 py-2.5">
                            {p.periods.length === 0
                              ? <span className="text-xs text-muted">—</span>
                              : <PeriodTags payment={p} />}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              title="Descargar recibo"
                              disabled={downloadingId === p.id}
                              onClick={async () => {
                                setDownloadingId(p.id);
                                try {
                                  await generarReciboPDF({
                                    cliente: name,
                                    monto: p.total_amount,
                                    metodo: PAYMENT_METHOD_LABELS[p.payment_method],
                                    fecha: p.payment_date,
                                    notas: p.notes ?? undefined,
                                    id: p.id,
                                    periodos: reciboPeriodos(p),
                                  });
                                } finally {
                                  setDownloadingId(null);
                                }
                              }}
                              className="rounded p-1 text-muted hover:text-primary disabled:opacity-40"
                            >
                              <FileDown className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Edit modal (z above the drawer) ────────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-popover p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-popover-foreground">{t.clients.editTitle}</h2>
              <button onClick={() => setEditOpen(false)} className="rounded-md p-1 text-muted hover:text-popover-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.clients.firstName} *</label>
                  <input type="text" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} required className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.clients.lastName} *</label>
                  <input type="text" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} required className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.common.phone} *</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required className={INPUT_CLS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.common.email}</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.common.address} *</label>
                <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} required className={INPUT_CLS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.common.notes}</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${INPUT_CLS} resize-none`} />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>{t.common.cancel}</Button>
                <Button type="submit" disabled={saving || !canSubmit}>
                  {saving ? t.common.saving : t.clients.saveChanges}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Record payment modal ────────────────────────────────────── */}
      <RecordPaymentModal
        clientId={client.id}
        clientName={name}
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={() => { fetchData(); onClientUpdated(); }}
      />
    </>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function InvoicesSkeleton() {
  return (
    <>
      {/* Mobile */}
      <ul className="divide-y divide-border sm:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="skeleton h-4 w-20 rounded" />
              <div className="skeleton h-5 w-14 rounded-full" />
            </div>
            <div className="skeleton h-3 w-40 rounded" />
          </li>
        ))}
      </ul>
      {/* Desktop */}
      <table className="hidden w-full text-sm sm:table">
        <tbody className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-24 rounded" /></td>
              <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PaymentsSkeleton() {
  return (
    <>
      {/* Mobile */}
      <ul className="divide-y divide-border sm:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-4 w-16 rounded" />
              </div>
              <div className="skeleton h-3 w-36 rounded" />
            </div>
            <div className="skeleton h-7 w-7 rounded" />
          </li>
        ))}
      </ul>
      {/* Desktop */}
      <table className="hidden w-full text-sm sm:table">
        <tbody className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3"><div className="skeleton h-4 w-24 rounded" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-28 rounded" /></td>
              <td className="px-2 py-3" />
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
