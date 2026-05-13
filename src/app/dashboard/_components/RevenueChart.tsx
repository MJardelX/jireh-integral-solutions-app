import type { MonthlyPoint } from '@/types/dashboard';

interface RevenueChartProps {
  data: MonthlyPoint[];
}

const W = 420;
const H = 180;
const CHART_TOP = 16;
const CHART_H = 120;
const BAR_W = 44;
const STRIDE = 62;  // bar width + gap
const PAD = 18;

function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

export function RevenueChart({ data }: RevenueChartProps) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  // current month = last item
  const currentIdx = data.length - 1;

  // Soft grid lines at 25 / 50 / 75 %
  const gridLines = [0.25, 0.5, 0.75, 1].map((pct) => ({
    y: CHART_TOP + CHART_H * (1 - pct),
    label: fmt(max * pct),
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Revenue last 6 months"
    >
      {/* Grid lines */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={PAD}
            y1={g.y}
            x2={W - PAD}
            y2={g.y}
            stroke="#433c33"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text x={PAD - 4} y={g.y + 4} textAnchor="end" fill="#978b75" fontSize={9}>
            {g.label}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = Math.max((d.amount / max) * CHART_H, 2);
        const x = PAD + i * STRIDE + (STRIDE - BAR_W) / 2;
        const y = CHART_TOP + (CHART_H - barH);
        const isCurrent = i === currentIdx;

        return (
          <g key={i}>
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={BAR_W}
              height={barH}
              rx={6}
              fill={isCurrent ? '#e8c833' : '#dd6900'}
              opacity={isCurrent ? 1 : 0.65}
              className="transition-opacity hover:opacity-100"
            />
            {/* Amount label on hover via title */}
            <title>{`${d.label}: ${fmt(d.amount)}`}</title>

            {/* Value above bar */}
            {d.amount > 0 && (
              <text
                x={x + BAR_W / 2}
                y={y - 5}
                textAnchor="middle"
                fill={isCurrent ? '#e8c833' : '#978b75'}
                fontSize={9}
                fontWeight={isCurrent ? 700 : 400}
              >
                {fmt(d.amount)}
              </text>
            )}

            {/* Month label */}
            <text
              x={x + BAR_W / 2}
              y={H - 4}
              textAnchor="middle"
              fill={isCurrent ? '#f7f2e4' : '#978b75'}
              fontSize={10}
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
    <div className="flex h-[180px] items-end gap-3 px-4 pb-6">
      {[40, 65, 55, 80, 70, 95].map((h, i) => (
        <div
          key={i}
          className="skeleton flex-1 rounded-md"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
