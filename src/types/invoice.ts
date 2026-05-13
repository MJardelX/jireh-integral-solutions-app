import type { PlanRecurrence } from './plan';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending:   'Pending',
  paid:      'Paid',
  overdue:   'Overdue',
  cancelled: 'Cancelled',
};

export interface Invoice {
  id: string;
  contract_id: string;
  reference_month: string;
  due_date: string;
  amount: number;
  status: InvoiceStatus;
  notes: string | null;
  issued_at: string;
  updated_at: string;
}

export interface InvoiceRow extends Invoice {
  client_id: string;
  client_name: string;
  client_email: string | null;
  plan_name: string;
  plan_recurrence: PlanRecurrence;
  due_day: number;
}
