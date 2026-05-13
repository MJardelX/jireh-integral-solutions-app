export interface MonthlyPoint {
  month: string;   // 'YYYY-MM'
  label: string;   // 'Jan', 'Feb'…
  amount: number;
}

export interface InvoiceStats {
  paid: number;
  pending: number;
  overdue: number;
  cancelled: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  collectionRate: number; // 0–100
}

export interface RecentPayment {
  id: string;
  clientName: string;
  amount: number;
  method: string;
  date: string;
}

export interface OverdueInvoice {
  id: string;
  clientName: string;
  planName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
}

export interface ClientAlert {
  clientId: string;
  clientName: string;
  overdueCount: number;
  overdueAmount: number;
  mostDaysOverdue: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
}

export interface DashboardData {
  clients: {
    active: number;
    total: number;
    newThisMonth: number;
    newLastMonth: number;
  };
  revenue: {
    currentMonth: number;
    lastMonth: number;
    mrr: number;
    monthlyTrend: MonthlyPoint[];
  };
  invoices: InvoiceStats;
  contracts: {
    active: number;
    suspended: number;
    cancelled: number;
  };
  recentPayments: RecentPayment[];
  overdueInvoices: OverdueInvoice[];
  clientAlerts: ClientAlert[];
}
