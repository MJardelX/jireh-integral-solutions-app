export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta_de_credito' | 'tarjeta_de_debito';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo:            'Cash',
  transferencia:       'Transfer',
  tarjeta_de_credito:  'Credit Card',
  tarjeta_de_debito:   'Debit Card',
};

export interface Payment {
  id: string;
  client_id: string;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/** One invoice covered by a payment, tied to the contract it was billed under. */
export interface PaymentPeriod {
  contract_id: string;
  plan_name: string;
  reference_month: string;
  amount_applied: number;
}

export interface PaymentRow extends Payment {
  client_name: string;
  recorded_by: string | null;
  invoice_count: number;
  periods: PaymentPeriod[];
}

export interface NewPaymentItem {
  invoice_id: string;
  amount_applied: number;
}
