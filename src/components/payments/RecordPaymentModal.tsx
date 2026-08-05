'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';
import { InvoicePicker } from '@/components/payments/InvoicePicker';
import type { InvoiceRow } from '@/types/invoice';
import type { PaymentMethod, NewPaymentItem } from '@/types/payment';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';

const PAYMENT_METHODS: PaymentMethod[] = [
  'efectivo', 'transferencia', 'tarjeta_de_credito', 'tarjeta_de_debito',
];

const INPUT_CLS =
  'w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15 dark:focus:border-primary';

export interface RecordPaymentModalProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RecordPaymentModal({
  clientId, clientName, open, onClose, onSuccess,
}: RecordPaymentModalProps) {
  const t = useT();
  const { authFetch } = useAuth();

  const [invs,        setInvs]        = useState<InvoiceRow[]>([]);
  const [loadingInvs, setLoadingInvs] = useState(false);
  const [selected,    setSelected]    = useState<Record<string, boolean>>({});
  const [form,        setForm]        = useState({
    total_amount:   '',
    payment_method: 'efectivo' as PaymentMethod,
    payment_date:   new Date().toISOString().slice(0, 10),
    notes:          '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm((f) => ({ ...f, total_amount: '', payment_date: new Date().toISOString().slice(0, 10) }));
    setSelected({});
    setError(null);
    setLoadingInvs(true);
    Promise.all([
      authFetch(`/api/invoices?client_id=${clientId}&status=overdue`),
      authFetch(`/api/invoices?client_id=${clientId}&status=pending`),
    ])
      .then(async ([r1, r2]) => {
        const { invoices: o } = await r1.json();
        const { invoices: p } = await r2.json();
        setInvs([...(o ?? []), ...(p ?? [])]);
      })
      .finally(() => setLoadingInvs(false));
  }, [open, clientId, authFetch]);

  function toggleInv(id: string) {
    setSelected((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const total = invs
        .filter((inv) => next[inv.id])
        .reduce((s, inv) => s + inv.amount, 0);
      setForm((f) => ({
        ...f,
        total_amount: total > 0 ? String(total.toFixed(2)) : f.total_amount,
      }));
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const items: NewPaymentItem[] = invs
        .filter((inv) => selected[inv.id])
        .map((inv) => ({ invoice_id: inv.id, amount_applied: inv.amount }));

      const res = await authFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          client_id:      clientId,
          total_amount:   parseFloat(form.total_amount),
          payment_method: form.payment_method,
          payment_date:   form.payment_date,
          notes:          form.notes,
          items,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error);
      }
      onClose();
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  const hasSelected = Object.values(selected).some(Boolean);
  const canSubmit =
    hasSelected &&
    form.total_amount !== '' &&
    parseFloat(form.total_amount) > 0 &&
    form.payment_date !== '';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-popover p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-popover-foreground">{t.clients.recordPayment}</h2>
            <p className="mt-0.5 text-sm text-muted">{clientName}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:text-popover-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">{t.clients.applyToInvoices}</p>
            {loadingInvs ? (
              <p className="text-xs text-muted">{t.clients.loadingInvoices}</p>
            ) : invs.length === 0 ? (
              <p className="text-xs text-muted">{t.clients.noOpenInvoices}</p>
            ) : (
              <InvoicePicker invoices={invs} selected={selected} onToggle={toggleInv} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t.clients.totalAmount} *</label>
              <input
                required type="number" step="0.01" min="0.01"
                value={form.total_amount}
                onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t.clients.paymentDate} *</label>
              <input
                required type="date"
                value={form.payment_date}
                onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t.clients.paymentMethod} *</label>
            <select
              required
              value={form.payment_method}
              onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value as PaymentMethod }))}
              className={INPUT_CLS}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{t.common.notes}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving ? t.common.saving : t.clients.recordPayment}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
