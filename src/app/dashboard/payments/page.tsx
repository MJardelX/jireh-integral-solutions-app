'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search, X, FileDown } from 'lucide-react';
import { Paginator } from '@/components/ui/paginator';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';
import { generarReciboPDF } from '@/lib/utils';
import { matchesTerm } from '@/lib/search';
import { describePeriods, reciboPeriodos } from '@/lib/contracts';
import { InvoicePicker } from '@/components/payments/InvoicePicker';
import type { PaymentRow, PaymentMethod, NewPaymentItem } from '@/types/payment';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { Client } from '@/types/client';
import type { InvoiceRow } from '@/types/invoice';

const METHODS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta_de_credito', 'tarjeta_de_debito'];

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);
}
function fmtMonth(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const EMPTY_FORM = {
  client_id: '', total_amount: '',
  payment_method: 'efectivo' as PaymentMethod,
  payment_date: new Date().toISOString().slice(0, 10),
  notes: '',
};

export default function PaymentsPage() {
  const t = useT();
  const { authFetch } = useAuth();

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameSearch, setNameSearch] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [clientInvs, setClientInvs] = useState<InvoiceRow[]>([]);
  const [loadingInvs, setLoadingInvs] = useState(false);
  const [selectedInvs, setSelectedInvs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const clientBoxRef = useRef<HTMLDivElement>(null);

  const loadPayments = useCallback(async (p = page, name = nameSearch, day = filterDay, month = filterMonth) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (name.trim()) params.set('client_name', name.trim());
      if (day) params.set('date', day);
      if (month) params.set('month', month);
      const res = await authFetch(`/api/payments?${params}`);
      if (!res.ok) throw new Error('Failed to load payments');
      const { payments: pData, total: tot } = await res.json();
      setPayments(pData);
      if (tot !== undefined) setTotal(tot);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [authFetch, page, nameSearch, filterDay, filterMonth]);

  useEffect(() => {
    Promise.all([
      loadPayments(),
      authFetch('/api/clients').then((r) => r.json()).then(({ clients: d }) => setClients(d ?? [])),
    ]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientBoxRef.current && !clientBoxRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredClients = clients.filter((c) =>
    matchesTerm(clientSearch, `${c.first_name} ${c.last_name}`)
  );

  async function onClientChange(clientId: string) {
    setForm((f) => ({ ...f, client_id: clientId }));
    setSelectedInvs({});
    if (!clientId) { setClientInvs([]); return; }

    setLoadingInvs(true);
    try {
      const res = await authFetch(`/api/invoices?client_id=${clientId}&status=pending`);
      const res2 = await authFetch(`/api/invoices?client_id=${clientId}&status=overdue`);
      const { invoices: p } = await res.json();
      const { invoices: o } = await res2.json();
      setClientInvs([...o, ...p]);
    } finally { setLoadingInvs(false); }
  }

  function toggleInv(id: string) {
    setSelectedInvs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      // Auto-sum total from selected invoices
      const tot = clientInvs
        .filter((inv) => next[inv.id])
        .reduce((s, inv) => s + inv.amount, 0);
      setForm((f) => ({ ...f, total_amount: tot > 0 ? String(tot.toFixed(2)) : f.total_amount }));
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_id) { setFormError('Please select a client'); return; }
    setSaving(true); setFormError(null);
    try {
      const items: NewPaymentItem[] = clientInvs
        .filter((inv) => selectedInvs[inv.id])
        .map((inv) => ({ invoice_id: inv.id, amount_applied: inv.amount }));

      const res = await authFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({ ...form, total_amount: parseFloat(form.total_amount), items }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setOpen(false);
      await loadPayments(1, nameSearch, filterDay, filterMonth);
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function downloadReceipt(p: PaymentRow) {
    setDownloadingId(p.id);
    try {
      await generarReciboPDF({
        cliente: p.client_name,
        monto:   p.total_amount,
        metodo:  PAYMENT_METHOD_LABELS[p.payment_method],
        fecha:   p.payment_date,
        notas:   p.notes || '',
        id:      p.id,
        periodos: reciboPeriodos(p),
      });
    } finally {
      setDownloadingId(null);
    }
  }

  const isFiltered = nameSearch.trim() !== '' || filterDay !== '' || filterMonth !== '';

  const hasInvoiceSelected = Object.values(selectedInvs).some(Boolean);
  const canSubmit =
    form.client_id !== '' &&
    hasInvoiceSelected &&
    form.total_amount !== '' && parseFloat(form.total_amount) > 0 &&
    form.payment_date !== '';

  const colHeaders = [t.payments.colClient, t.payments.colDate, t.payments.colAmount, t.payments.colMethod, t.payments.colMonths, t.payments.colRecordedBy];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-popover-foreground">{t.payments.title}</h1>
          <p className="mt-0.5 text-sm text-muted">{total} {t.common.total}</p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM, payment_date: new Date().toISOString().slice(0, 10) }); setClientInvs([]); setSelectedInvs({}); setFormError(null); setClientSearch(''); setDropOpen(false); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> {t.payments.addPayment}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            placeholder={t.payments.searchPlaceholder}
            value={nameSearch}
            onChange={(e) => {
              const v = e.target.value;
              setNameSearch(v);
              setPage(1);
              if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
              nameDebounceRef.current = setTimeout(() => loadPayments(1, v, filterDay, filterMonth), 350);
            }}
            className="w-full rounded-lg border border-border bg-input pl-9 pr-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted whitespace-nowrap">{t.payments.filterDay}</label>
          <input
            type="date"
            value={filterDay}
            onChange={(e) => { const v = e.target.value; setFilterDay(v); if (v) setFilterMonth(''); setPage(1); loadPayments(1, nameSearch, v, v ? '' : filterMonth); }}
            className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted whitespace-nowrap">{t.payments.filterMonth}</label>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => { const v = e.target.value; setFilterMonth(v); if (v) setFilterDay(''); setPage(1); loadPayments(1, nameSearch, v ? '' : filterDay, v); }}
            className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15"
          />
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-border bg-popover">
        {loading ? (
          <PaymentsTableSkeleton colHeaders={colHeaders} />
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted">
            {!isFiltered ? t.payments.noPaymentsYet : t.payments.noPaymentsSearch}
          </div>
        ) : (
          <>
            {/* ── Mobile: card list ─────────────────────────────────────── */}
            <ul className="divide-y divide-border sm:hidden">
              {payments.map((p) => (
                <li key={p.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-popover-foreground truncate">{p.client_name}</span>
                        <span className="shrink-0 text-sm font-semibold text-primary">{fmtCurrency(p.total_amount)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {new Date(p.payment_date + 'T00:00:00').toLocaleDateString()} · {PAYMENT_METHOD_LABELS[p.payment_method]}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {describePeriods(p, fmtMonth)}
                        {p.recorded_by && ` · ${p.recorded_by}`}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="shrink-0"
                      title={t.payments.downloadReceipt}
                      aria-label={t.payments.downloadReceipt}
                      disabled={downloadingId === p.id}
                      onClick={() => downloadReceipt(p)}
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
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
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-border/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-popover-foreground">{p.client_name}</td>
                    <td className="px-4 py-3 text-muted">{new Date(p.payment_date + 'T00:00:00').toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-popover-foreground">{fmtCurrency(p.total_amount)}</td>
                    <td className="px-4 py-3 text-muted">{PAYMENT_METHOD_LABELS[p.payment_method]}</td>
                    <td className="px-4 py-3 text-muted">{describePeriods(p, fmtMonth)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted">{p.recorded_by ?? '—'}</span>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          title={t.payments.downloadReceipt}
                          aria-label={t.payments.downloadReceipt}
                          disabled={downloadingId === p.id}
                          onClick={() => downloadReceipt(p)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
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
        onChange={(p) => { setPage(p); loadPayments(p, nameSearch, filterDay, filterMonth); }}
      />

      {/* Record Payment modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-popover p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-popover-foreground">{t.payments.newTitle}</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:text-popover-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Client — searchable combobox */}
              <div ref={clientBoxRef} className="relative">
                <label className="mb-1 block text-xs font-medium text-muted">{t.payments.clientLabel} *</label>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder={t.payments.searchClient}
                  value={clientSearch}
                  onFocus={() => setDropOpen(true)}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setDropOpen(true);
                    if (!e.target.value) onClientChange('');
                  }}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15"
                />
                {dropOpen && filteredClients.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
                    {filteredClients.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setClientSearch(`${c.first_name} ${c.last_name}`);
                            setDropOpen(false);
                            onClientChange(c.id);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-border/40 ${form.client_id === c.id ? 'font-medium text-primary' : 'text-popover-foreground'}`}
                        >
                          {c.first_name} {c.last_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Pending / overdue invoices for selected client */}
              {form.client_id && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">{t.payments.applyToInvoices}</p>
                  {loadingInvs ? (
                    <p className="text-xs text-muted">{t.payments.loadingInvoices}</p>
                  ) : clientInvs.length === 0 ? (
                    <p className="text-xs text-muted">{t.payments.noOpenInvoices}</p>
                  ) : (
                    <InvoicePicker invoices={clientInvs} selected={selectedInvs} onToggle={toggleInv} />
                  )}
                </div>
              )}

              {/* Payment details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.payments.amountLabel} *</label>
                  <input required type="number" step="0.01" min="0.01" value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.payments.dateLabel} *</label>
                  <input required type="date" value={form.payment_date} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.payments.methodLabel} *</label>
                <select required value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value as PaymentMethod }))}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15">
                  {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.common.notes}</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
                <Button type="submit" disabled={saving || !canSubmit}>{saving ? t.common.saving : t.payments.addPayment}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const SK = [
  { client: 'w-36', amount: 'w-16', method: 'w-20' },
  { client: 'w-28', amount: 'w-14', method: 'w-24' },
  { client: 'w-44', amount: 'w-16', method: 'w-20' },
  { client: 'w-32', amount: 'w-12', method: 'w-20' },
  { client: 'w-40', amount: 'w-16', method: 'w-24' },
];

function PaymentsTableSkeleton({ colHeaders }: { colHeaders: string[] }) {
  return (
    <>
      {/* Mobile */}
      <ul className="divide-y divide-border sm:hidden">
        {SK.map((w, i) => (
          <li key={i} className="px-4 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`skeleton h-4 rounded ${w.client}`} />
              <div className={`skeleton h-4 rounded ${w.amount}`} />
            </div>
            <div className="flex items-center gap-2">
              <div className="skeleton h-3 w-20 rounded" />
              <div className={`skeleton h-3 rounded ${w.method}`} />
            </div>
            <div className="skeleton h-3 w-28 rounded" />
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
              <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.amount}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.method}`} /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-24 rounded" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
