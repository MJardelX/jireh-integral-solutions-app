import type { RecentPayment } from '@/types/dashboard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const METHOD_LABELS: Record<string, string> = {
  efectivo:           'Cash',
  transferencia:      'Transfer',
  tarjeta_de_credito: 'Credit Card',
  tarjeta_de_debito:  'Debit Card',
};

const METHOD_COLORS: Record<string, string> = {
  efectivo:           'bg-[#7f9d32]/15 text-[#7f9d32]',
  transferencia:      'bg-[#3f6a8d]/15 text-[#3f6a8d]',
  tarjeta_de_credito: 'bg-[#dd6900]/15 text-[#dd6900]',
  tarjeta_de_debito:  'bg-[#e8c833]/15 text-[#e8c833]',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);
}

interface RecentPaymentsCardProps {
  payments: RecentPayment[];
  loading?: boolean;
}

export function RecentPaymentsCard({ payments, loading }: RecentPaymentsCardProps) {
  if (loading) return <TableSkeleton rows={5} />;

  if (payments.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted">
        No payments recorded yet
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="text-muted">Client</TableHead>
          <TableHead className="text-muted">Method</TableHead>
          <TableHead className="text-muted">Date</TableHead>
          <TableHead className="text-right text-muted">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id} className="border-border">
            <TableCell className="font-medium text-popover-foreground">{p.clientName}</TableCell>
            <TableCell>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${METHOD_COLORS[p.method] ?? 'bg-muted/20 text-muted'}`}>
                {METHOD_LABELS[p.method] ?? p.method}
              </span>
            </TableCell>
            <TableCell className="text-muted">{fmtDate(p.date)}</TableCell>
            <TableCell className="text-right font-semibold text-[#7f9d32]">
              {fmtMoney(p.amount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="skeleton h-4 flex-1 rounded" />
          <div className="skeleton h-5 w-20 rounded-full" />
          <div className="skeleton h-4 w-16 rounded" />
          <div className="skeleton h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
