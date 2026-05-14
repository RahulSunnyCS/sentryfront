'use client';

interface SeriesPoint {
  date: string;
  fpRate: number;
  samples: number;
}

interface Bucket {
  moduleId: string;
  confidence: string | null;
  series: SeriesPoint[];
  latest: {
    fpRate: number;
    helpfulRate: number;
    samples: number;
    fpCount: number;
    helpfulCount: number;
    dismissedCount: number;
    fixDidntHelpCount: number;
    missedOtherCount: number;
  };
  sampleSizeReady: boolean;
  flagged: boolean;
}

function Sparkline({ series }: { series: SeriesPoint[] }) {
  if (series.length === 0) {
    return <span className="text-white/40 text-xs">no data</span>;
  }
  const width = 120;
  const height = 32;
  const max = Math.max(0.05, ...series.map((s) => s.fpRate));
  const xStep = series.length > 1 ? width / (series.length - 1) : 0;
  const points = series
    .map((s, i) => `${i * xStep},${height - (s.fpRate / max) * height}`)
    .join(' ');
  return (
    <svg width={width} height={height} aria-label="FP-rate sparkline">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
        className="text-white/60"
      />
    </svg>
  );
}

export function FpRatesView({
  buckets,
  windowDays,
  sampleSizeFloor,
  flagFpRate,
}: {
  buckets: Bucket[];
  windowDays: number;
  sampleSizeFloor: number;
  flagFpRate: number;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">FP rates</h1>
      <p className="text-sm text-white/60 mt-1">
        Last {windowDays} days. Flagged red when fpRate ≥ {(flagFpRate * 100).toFixed(0)}% AND
        samples ≥ {sampleSizeFloor}. Below the floor, rates are shown grey — too few signals to
        act on.
      </p>

      {buckets.length === 0 ? (
        <p className="mt-8 text-sm text-white/50">
          No snapshots yet. Trigger the aggregate-fp-rates cron from{' '}
          <a className="underline" href="/internal/cron">
            /internal/cron
          </a>{' '}
          once dispositions have been collected.
        </p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-white/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="py-2 pr-4">Module</th>
              <th className="py-2 pr-4">Confidence</th>
              <th className="py-2 pr-4">Latest FP rate</th>
              <th className="py-2 pr-4">Samples</th>
              <th className="py-2 pr-4">Helpful</th>
              <th className="py-2 pr-4">Missed</th>
              <th className="py-2 pr-4">Trend</th>
              <th className="py-2 pr-4">State</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr
                key={`${b.moduleId}::${b.confidence ?? ''}`}
                className="border-t border-white/10"
              >
                <td className="py-2 pr-4 font-mono">{b.moduleId}</td>
                <td className="py-2 pr-4 text-white/70">{b.confidence ?? '—'}</td>
                <td className="py-2 pr-4">
                  <span className={b.flagged ? 'text-red-400 font-semibold' : 'text-white/80'}>
                    {(b.latest.fpRate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 pr-4 text-white/70">{b.latest.samples}</td>
                <td className="py-2 pr-4 text-white/70">
                  {(b.latest.helpfulRate * 100).toFixed(1)}%
                </td>
                <td className="py-2 pr-4 text-white/70">{b.latest.missedOtherCount}</td>
                <td className="py-2 pr-4">
                  <Sparkline series={b.series} />
                </td>
                <td className="py-2 pr-4">
                  {b.flagged ? (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                      flagged
                    </span>
                  ) : b.sampleSizeReady ? (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                      ok
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                      &lt;{sampleSizeFloor} samples
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
