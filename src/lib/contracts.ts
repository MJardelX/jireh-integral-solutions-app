/**
 * Labelling helpers for clients that hold more than one contract.
 *
 * A contract is identified to the user by its nickname when it has one
 * ("Casa", "Negocio"), otherwise by its plan name. Plan names are ambiguous
 * when the same plan is contracted twice and neither was given a nickname, so
 * a short contract code is appended — but only in that case, to keep the
 * common screens clean.
 */

import type { PaymentRow } from '@/types/payment';
import type { ReciboPeriodo } from '@/lib/utils';

/** Short, stable, human-quotable code for a contract: "#3F9A21". */
export function contractCode(contractId: string): string {
  return `#${contractId.slice(0, 6).toUpperCase()}`;
}

interface Labelable {
  contract_id: string;
  contract_label: string | null;
  plan_name: string;
}

/**
 * Maps contract_id → display label over a set of rows belonging to one client.
 * Returns the contract's nickname when it has one, else the plan name, else
 * "Plan Básico #3F9A21" when two unnamed contracts share a plan.
 */
export function contractLabels(rows: Labelable[]): Record<string, string> {
  const contractsByName = new Map<string, Set<string>>();
  for (const r of rows) {
    const name = baseName(r);
    if (!contractsByName.has(name)) contractsByName.set(name, new Set());
    contractsByName.get(name)!.add(r.contract_id);
  }

  const labels: Record<string, string> = {};
  for (const r of rows) {
    const name = baseName(r);
    const ambiguous = (contractsByName.get(name)?.size ?? 0) > 1;
    labels[r.contract_id] = ambiguous ? `${name} ${contractCode(r.contract_id)}` : name;
  }
  return labels;
}

function baseName(row: Labelable): string {
  return row.contract_label?.trim() || row.plan_name;
}

/** "Plan Básico — ago 2026 · Plan Negocio — ago 2026", for payment listings. */
export function describePeriods(payment: PaymentRow, fmtMonth: (month: string) => string): string {
  if (payment.periods.length === 0) return '—';
  const labels = contractLabels(payment.periods);
  return payment.periods
    .map((p) => `${labels[p.contract_id] || p.plan_name || '—'} — ${fmtMonth(p.reference_month)}`)
    .join(' · ');
}

/** Receipt lines for `generarReciboPDF`, one per invoice covered by the payment. */
export function reciboPeriodos(payment: PaymentRow): ReciboPeriodo[] {
  const labels = contractLabels(payment.periods);
  return payment.periods.map((p) => ({
    plan:  labels[p.contract_id] || p.plan_name,
    mes:   p.reference_month,
    monto: p.amount_applied,
  }));
}
