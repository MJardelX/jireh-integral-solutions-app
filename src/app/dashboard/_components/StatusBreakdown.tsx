import { cn } from '@/lib/utils';
import type { InvoiceStats } from '@/types/dashboard';

interface StatusBreakdownProps {
  stats: InvoiceStats;
}

const STATUS_CONFIG = [
  { key: 'paid',      label: 'Paid',      color: '#7f9d32', bg: 'bg-[#7f9d32]' },
  { key: 'pending',   label: 'Pending',   color: '#dd6900', bg: 'bg-[#dd6900]' },
  { key: 'overdue',   label: 'Overdue',   color: '#cf4528', bg: 'bg-[#cf4528]' },
  { key: 'cancelled', label: 'Cancelled', color: '#978b75', bg: 'bg-[#978b75]' },
] as const;

function fmt(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 0 }).format(n);
}

export function StatusBreakdown({ stats }: StatusBreakdownProps) {
  const total = stats.paid + stats.pending + stats.overdue + stats.cancelled;

  const rows = STATUS_CONFIG.map((s) => {
    const count = stats[s.key as keyof InvoiceStats] as number;
    const amount = s.key === 'cancelled' ? 0 :
      (stats[`${s.key}Amount` as keyof InvoiceStats] as number) ?? 0;
    const pct = total > 0 ? (count / total) * 100 : 0;
    return { ...s, count, amount, pct };
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Collection rate hero number */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold text-[#e8c833]">
          {stats.collectionRate.toFixed(1)}%
        </span>
        <span className="mb-1 text-sm text-muted">collection rate</span>
      </div>

      {/* Segmented total bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-border/40">
        {rows.map((r) => (
          <div
            key={r.key}
            className={cn('h-full transition-all', r.bg)}
            style={{ width: `${r.pct}%` }}
          />
        ))}
      </div>

      {/* Status rows */}
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: r.color }}
            />
            <div className="flex flex-1 items-center justify-between">
              <span className="text-sm text-popover-foreground">{r.label}</span>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{r.count} invoices</span>
                {r.amount > 0 && (
                  <span className="font-medium" style={{ color: r.color }}>
                    {fmt(r.amount)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total bar below each row */}
      <div className="flex flex-col gap-2.5 border-t border-border pt-3">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <div className="w-16 shrink-0 text-xs text-muted">{r.label}</div>
            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-border/40">
              <div
                className={cn('h-full rounded-full transition-all', r.bg)}
                style={{ width: `${r.pct}%` }}
              />
            </div>
            <div className="w-8 shrink-0 text-right text-xs text-muted">
              {r.pct.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusBreakdownSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="skeleton h-10 w-28 rounded-lg" />
      <div className="skeleton h-2.5 w-full rounded-full" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton h-2.5 w-2.5 rounded-full" />
          <div className="skeleton h-4 flex-1 rounded" />
          <div className="skeleton h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
