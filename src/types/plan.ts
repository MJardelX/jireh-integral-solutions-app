export type PlanRecurrence = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export const RECURRENCE_LABELS: Record<PlanRecurrence, string> = {
  monthly:    'Monthly',
  quarterly:  'Quarterly',
  semiannual: 'Semi-annual',
  annual:     'Annual',
};

export interface ServicePlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  recurrence: PlanRecurrence;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
