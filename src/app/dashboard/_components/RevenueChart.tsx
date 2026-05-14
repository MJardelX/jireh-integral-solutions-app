import type { MonthlyPoint } from '@/types/dashboard';

interface RevenueChartProps {
  data: MonthlyPoint[];
  currentMonthKey: string; // 'YYYY-MM' — bar to highlight
}

const W          = 620;
const H          = 200;
const CHART_TOP  = 20;
const CHART_H    = 130;
const BAR_W      = 32;
const STRIDE     = 48;   // bar + gap (12 × 48 + 2 × 13 = 602 ≈ fits in 620)
const PAD        = 14;

function fmt(n: number) {
  if (n >= 1000) return `Q${(n / 1000).toFixed(1)}k`;
  return `Q${n}`;
}

export function RevenueChart({ data, currentMonthKey }: RevenueChartProps) {
  const max = Math.max(...data.map((d) => d.amount), 1);

  const gridLines = [0.25, 0.5, 0.75, 1].map((pct) => ({
    y: CHART_TOP + CHART_H * (1 - pct),
    label: fmt(max * pct),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Revenue by month">
      {/* Grid lines */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={PAD} y1={g.y} x2={W - PAD} y2={g.y}
            stroke="#433c33" strokeWidth={1} strokeDasharray="4 4"
          />
          <text x={PAD - 4} y={g.y + 4} textAnchor="end" fill="#978b75" fontSize={8}>
            {g.label}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const barH      = Math.max((d.amount / max) * CHART_H, 2);
        const x         = PAD + i * STRIDE + (STRIDE - BAR_W) / 2;
        const y         = CHART_TOP + (CHART_H - barH);
        const isCurrent = d.month === currentMonthKey;
        const hasValue  = d.amount > 0;

        return (
          <g key={i}>
            <rect
              x={x} y={y} width={BAR_W} height={barH} rx={5}
              fill={isCurrent ? '#e8c833' : '#dd6900'}
              opacity={isCurrent ? 1 : hasValue ? 0.7 : 0.15}
              className="transition-opacity hover:opacity-100"
            />
            <title>{`${d.label}: ${fmt(d.amount)}`}</title>

            {hasValue && (
              <text
                x={x + BAR_W / 2} y={y - 5}
                textAnchor="middle"
                fill={isCurrent ? '#e8c833' : '#978b75'}
                fontSize={8}
                fontWeight={isCurrent ? 700 : 400}
              >
                {fmt(d.amount)}
              </text>
            )}

            <text
              x={x + BAR_W / 2} y={H - 4}
              textAnchor="middle"
              fill={isCurrent ? '#f7f2e4' : '#978b75'}
              fontSize={9}
              fontWeight={isCurrent ? 600 : 400}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RevenueChartSkeleton() {
  return (
    <div className="flex h-[200px] items-end gap-2 px-2 pb-6">
      {[30, 55, 45, 70, 60, 85, 50, 75, 65, 90, 80, 95].map((h, i) => (
        <div key={i} className="skeleton flex-1 rounded-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
