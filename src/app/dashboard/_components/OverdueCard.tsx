'use client';

import { useState } from 'react';
import type { OverdueInvoice } from '@/types/dashboard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Paginator } from '@/components/ui/paginator';

const PAGE_SIZE = 10;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);
}

function urgencyColor(days: number): string {
  if (days > 30) return 'text-[#cf4528] font-semibold';
  if (days > 14) return 'text-[#dd6900] font-medium';
  return 'text-muted';
}

interface OverdueCardProps {
  invoices: OverdueInvoice[];
  loading?: boolean;
}

export function OverdueCard({ invoices, loading }: OverdueCardProps) {
  const [page, setPage] = useState(1);

  // Clamped rather than reset, so a refresh doesn't kick the user back to page 1
  const totalPages  = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible     = invoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) return <TableSkeleton rows={5} />;

  if (invoices.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-[#7f9d32]">
        <span className="text-2xl">✓</span>
        No overdue invoices
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted">Client</TableHead>
            <TableHead className="text-muted">Plan</TableHead>
            <TableHead className="text-muted">Due</TableHead>
            <TableHead className="text-muted">Days</TableHead>
            <TableHead className="text-right text-muted">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((inv) => (
            <TableRow key={inv.id} className="border-border">
              <TableCell className="font-medium text-popover-foreground">{inv.clientName}</TableCell>
              <TableCell className="max-w-[120px] truncate text-muted">{inv.planName}</TableCell>
              <TableCell className="text-muted">{fmtDate(inv.dueDate)}</TableCell>
              <TableCell className={urgencyColor(inv.daysOverdue)}>
                {inv.daysOverdue}d
              </TableCell>
              <TableCell className="text-right font-semibold text-[#cf4528]">
                {fmtMoney(inv.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Paginator
        page={currentPage}
        total={invoices.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />
    </>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="skeleton h-4 flex-1 rounded" />
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-4 w-14 rounded" />
          <div className="skeleton h-4 w-8 rounded" />
          <div className="skeleton h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
