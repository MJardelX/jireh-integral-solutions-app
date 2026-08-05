/**
 * Labelling helpers for clients that hold more than one contract.
 *
 * A payment or an invoice is identified to the user by its plan name. That is
 * enough while a client's contracts all use different plans; when the same plan
 * is contracted twice (two houses on the same package, say) the plan name alone
 * is ambiguous, so a short contract code is appended — but only in that case,
 * to keep the common screens clean.
 */

import type { PaymentRow } from '@/types/payment';
import type { ReciboPeriodo } from '@/lib/utils';

/** Short, stable, human-quotable code for a contract: "#3F9A21". */
export function contractCode(contractId: string): string {
  return `#${contractId.slice(0, 6).toUpperCase()}`;
}

interface Labelable {
  contract_id: string;
  plan_name: string;
}

/**
 * Maps contract_id → display label over a set of rows belonging to one client.
 * Returns "Plan Básico" normally, "Plan Básico #3F9A21" where the plan repeats
 * across two different contracts.
 */
export function contractLabels(rows: Labelable[]): Record<string, string> {
  const contractsByPlan = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!contractsByPlan.has(r.plan_name)) contractsByPlan.set(r.plan_name, new Set());
    contractsByPlan.get(r.plan_name)!.add(r.contract_id);
  }

  const labels: Record<string, string> = {};
  for (const r of rows) {
    const ambiguous = (contractsByPlan.get(r.plan_name)?.size ?? 0) > 1;
    labels[r.contract_id] = ambiguous
      ? `${r.plan_name} ${contractCode(r.contract_id)}`
      : r.plan_name;
  }
  return labels;
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
