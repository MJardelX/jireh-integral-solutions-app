import type { PlanRecurrence } from './plan';

export type ContractStatus = 'active' | 'suspended' | 'cancelled';

export interface Contract {
  id: string;
  client_id: string;
  plan_id: string;
  special_price: number | null;
  status: ContractStatus;
  start_date: string;
  end_date: string | null;
  due_day: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractRow extends Contract {
  client_name: string;
  client_email: string | null;
  plan_name: string;
  plan_price: number;
  plan_recurrence: PlanRecurrence;
  effective_price: number;
}
