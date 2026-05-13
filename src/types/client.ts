export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  address: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function fullName(c: Pick<Client, 'first_name' | 'last_name'>) {
  return `${c.first_name} ${c.last_name}`;
}
