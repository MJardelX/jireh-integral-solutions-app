'use client';

import type { ClientAlert } from '@/types/dashboard';
import { useT } from '@/context/I18nContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency', currency: 'GTQ', maximumFractionDigits: 0,
  }).format(n);
}

function daysColor(days: number) {
  if (days > 30) return 'text-[#cf4528] font-semibold';
  if (days > 14) return 'text-[#dd6900] font-medium';
  return 'text-muted';
}

interface ClientAlertsTableProps {
  clients: ClientAlert[];
  loading?: boolean;
  onPayment?: (clientId: string, clientName: string) => void;
}

export function ClientAlertsTable({ clients, loading, onPayment }: ClientAlertsTableProps) {
  const t = useT();

  if (loading) return <Skeleton />;

  if (clients.length === 0) {
    return (
      <div className="flex h-20 flex-col items-center justify-center gap-1.5 text-sm text-[#7f9d32]">
        <span className="text-xl">✓</span>
        {t.dashboard.clientAlertsAllClear}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="text-muted">{t.dashboard.clientAlertsColClient}</TableHead>
          <TableHead className="text-center text-muted">{t.dashboard.clientAlertsColOverdue}</TableHead>
          <TableHead className="text-muted">{t.dashboard.clientAlertsColAmount}</TableHead>
          <TableHead className="text-muted">{t.dashboard.clientAlertsColOldest}</TableHead>
          <TableHead className="text-muted">{t.dashboard.clientAlertsColLastPayment}</TableHead>
          {onPayment && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow key={c.clientId} className="border-border">
            <TableCell className="font-medium text-popover-foreground">{c.clientName}</TableCell>
            <TableCell className="text-center">
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#cf4528] px-1.5 text-xs font-bold text-white">
                {c.overdueCount}
              </span>
            </TableCell>
            <TableCell className="font-semibold text-[#cf4528]">
              {fmtMoney(c.overdueAmount)}
            </TableCell>
            <TableCell className={daysColor(c.mostDaysOverdue)}>
              {c.mostDaysOverdue}d
            </TableCell>
            <TableCell className="text-sm text-muted">
              {c.lastPaymentDate ? (
                <span>
                  {fmtDate(c.lastPaymentDate)}{' '}
                  <span className="text-[#7f9d32]">· {fmtMoney(c.lastPaymentAmount!)}</span>
                </span>
              ) : (
                <span className="italic opacity-60">{t.dashboard.clientAlertsNeverPaid}</span>
              )}
            </TableCell>
            {onPayment && (
              <TableCell className="text-right">
                <button
                  onClick={() => onPayment(c.clientId, c.clientName)}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-80"
                  style={{ background: 'linear-gradient(135deg, #dd6900 0%, #c45e00 100%)' }}
                >
                  {t.clients.recordPayment}
                </button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="skeleton h-4 flex-1 rounded" />
          <div className="skeleton h-5 w-8 rounded-full" />
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-4 w-10 rounded" />
          <div className="skeleton h-4 w-32 rounded" />
        </div>
      ))}
    </div>
  );
}
