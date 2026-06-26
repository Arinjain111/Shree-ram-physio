import type { PainTrendPoint } from '@/types/database.types';

interface PainTrendChartProps {
  trend: PainTrendPoint[];
}

export const PainTrendChart = ({ trend }: PainTrendChartProps) => {
  if (trend.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-medium">
        Need at least 2 attended sessions with pain data to show a trend.
      </div>
    );
  }

  const width = 480;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 35 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxPain = 10;
  const xStep = chartW / (trend.length - 1);

  const toX = (i: number) => padding.left + i * xStep;
  const toY = (v: number) => padding.top + chartH - (v / maxPain) * chartH;

  const beforePoints = trend.map((p, i) => `${toX(i)},${toY(p.painBefore)}`).join(' ');
  const afterPoints = trend.map((p, i) => `${toX(i)},${toY(p.painAfter)}`).join(' ');

  const avgDelta = trend.reduce((s, p) => s + p.painDelta, 0) / trend.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-500 rounded-full" />
            <span className="text-slate-500">Pain Before</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-500 rounded-full" />
            <span className="text-slate-500">Pain After</span>
          </div>
        </div>
        <div className={`text-xs font-bold px-2 py-1 rounded-lg ${
          avgDelta >= 2 ? 'bg-emerald-50 text-emerald-700' :
          avgDelta >= 0.5 ? 'bg-blue-50 text-blue-700' :
          avgDelta >= 0 ? 'bg-amber-50 text-amber-700' :
          'bg-rose-50 text-rose-700'
        }`}>
          Avg relief: {avgDelta >= 0 ? '-' : '+'}{Math.abs(avgDelta).toFixed(1)}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxWidth: width }}>
        {[0, 2, 4, 6, 8, 10].map(v => (
          <g key={v}>
            <line
              x1={padding.left}
              y1={toY(v)}
              x2={width - padding.right}
              y2={toY(v)}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={toY(v) + 4}
              textAnchor="end"
              className="fill-slate-400"
              fontSize={10}
              fontWeight={600}
            >
              {v}
            </text>
          </g>
        ))}

        <polyline
          points={beforePoints}
          fill="none"
          stroke="#f43f5e"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <polyline
          points={afterPoints}
          fill="none"
          stroke="#10b981"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {trend.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.painBefore)} r={3.5} fill="#f43f5e" stroke="white" strokeWidth={1.5} />
            <circle cx={toX(i)} cy={toY(p.painAfter)} r={3.5} fill="#10b981" stroke="white" strokeWidth={1.5} />
            <text
              x={toX(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-400"
              fontSize={9}
              fontWeight={600}
            >
              S{p.sessionNumber}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
