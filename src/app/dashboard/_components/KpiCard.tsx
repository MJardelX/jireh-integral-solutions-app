import { cn } from '@/lib/utils';

type Accent = 'orange' | 'gold' | 'green' | 'red' | 'blue';

interface KpiCardProps {
  title: string;
  value: string;
  subValue?: string;
  trend?: { value: number; label: string };
  icon: React.ReactNode;
  accent?: Accent;
  alert?: boolean;   // red glow for critical cards
  loading?: boolean;
}

const accentStyles: Record<Accent, { icon: string; value: string }> = {
  orange: { icon: 'bg-[#dd6900]/15 text-[#dd6900]',  value: 'text-[#dd6900]' },
  gold:   { icon: 'bg-[#e8c833]/15 text-[#e8c833]',  value: 'text-[#e8c833]' },
  green:  { icon: 'bg-[#7f9d32]/15 text-[#7f9d32]',  value: 'text-[#7f9d32]' },
  red:    { icon: 'bg-[#cf4528]/15 text-[#cf4528]',   value: 'text-[#cf4528]' },
  blue:   { icon: 'bg-[#3f6a8d]/15 text-[#3f6a8d]',  value: 'text-[#3f6a8d]' },
};

export function KpiCard({
  title,
  value,
  subValue,
  trend,
  icon,
  accent = 'orange',
  alert = false,
  loading = false,
}: KpiCardProps) {
  if (loading) return <KpiSkeleton />;

  const styles = accentStyles[accent];
  const trendPositive = trend && trend.value > 0;
  const trendNegative = trend && trend.value < 0;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-4 rounded-2xl border border-border bg-popover p-5 transition-shadow hover:shadow-lg',
        alert && 'border-[#cf4528]/40 shadow-[0_0_24px_rgba(207,69,40,0.12)]'
      )}
    >
      {/* Top row: icon + trend */}
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', styles.icon)}>
          {icon}
        </div>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              trendPositive && 'bg-[#7f9d32]/15 text-[#7f9d32]',
              trendNegative && 'bg-[#cf4528]/15 text-[#cf4528]',
              !trendPositive && !trendNegative && 'bg-muted/20 text-muted'
            )}
          >
            {trendPositive && '↑'}
            {trendNegative && '↓'}
            {trend.label}
          </span>
        )}
      </div>

      {/* Value */}
      <div>
        <p className={cn('text-3xl font-bold tracking-tight', styles.value)}>{value}</p>
        <p className="mt-0.5 text-sm font-medium text-popover-foreground">{title}</p>
      </div>

      {/* Sub value */}
      {subValue && (
        <p className="border-t border-border pt-3 text-xs text-muted">{subValue}</p>
      )}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-popover p-5">
      <div className="skeleton h-10 w-10 rounded-xl" />
      <div className="space-y-2">
        <div className="skeleton h-8 w-24 rounded-md" />
        <div className="skeleton h-4 w-32 rounded-md" />
      </div>
      <div className="border-t border-border pt-3">
        <div className="skeleton h-3 w-40 rounded-md" />
      </div>
    </div>
  );
}
