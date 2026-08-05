'use client';

import { AlertTriangle } from 'lucide-react';
import { useT } from '@/context/I18nContext';
import { contractLabels } from '@/lib/contracts';
import type { InvoiceRow } from '@/types/invoice';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);
}
function fmtMonth(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-GT', { month: 'short', year: 'numeric' });
}

export interface InvoicePickerProps {
  invoices: InvoiceRow[];
  selected: Record<string, boolean>;
  onToggle: (invoiceId: string) => void;
}

/**
 * Open-invoice checklist shared by both payment modals. Invoices are grouped by
 * contract so that a client holding several of them can't have a payment applied
 * to the wrong one by accident.
 */
export function InvoicePicker({ invoices, selected, onToggle }: InvoicePickerProps) {
  const t = useT();
  const labels = contractLabels(invoices);

  // Preserve the incoming order (overdue first) while grouping
  const groups: { contractId: string; rows: InvoiceRow[] }[] = [];
  for (const inv of invoices) {
    const group = groups.find((g) => g.contractId === inv.contract_id);
    if (group) group.rows.push(inv);
    else groups.push({ contractId: inv.contract_id, rows: [inv] });
  }
  const multiContract = groups.length > 1;

  return (
    <div className="space-y-2">
      {multiContract && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t.payments.multiContractNote.replace('{n}', String(groups.length))}</span>
        </div>
      )}

      <div className="space-y-1.5 rounded-xl border border-border p-3">
        {groups.map((g) => (
          <div key={g.contractId} className={multiContract ? 'pt-1 first:pt-0' : undefined}>
            {multiContract && (
              <p className="px-2 pb-1 text-xs font-semibold text-primary">{labels[g.contractId]}</p>
            )}
            {g.rows.map((inv) => (
              <label
                key={inv.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-border/30"
              >
                <input
                  type="checkbox"
                  checked={!!selected[inv.id]}
                  onChange={() => onToggle(inv.id)}
                  className="accent-primary"
                />
                <span className="flex-1 text-sm text-popover-foreground">
                  {multiContract
                    ? fmtMonth(inv.reference_month)
                    : `${labels[inv.contract_id]} — ${fmtMonth(inv.reference_month)}`}
                </span>
                <span className={`text-xs ${inv.status === 'overdue' ? 'text-destructive' : 'text-muted'}`}>
                  {inv.status === 'overdue' ? t.invoices.statusOverdue : t.invoices.statusPending}
                </span>
                <span className="text-sm font-medium text-popover-foreground">
                  {fmtCurrency(inv.amount)}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
