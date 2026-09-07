"use client";

// Minimal inline SVG sparkline built from a rolling client-side history —
// deliberately no charting library dependency for something this small.
export function NetworkSparkline({ history }: { history: number[] }) {
  if (history.length < 2) return <div className="h-8" />;

  const max = Math.max(...history, 1);
  const width = 100;
  const height = 32;
  const step = width / (history.length - 1);

  const points = history.map((v, i) => `${i * step},${height - (v / max) * height}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-blue-400" />
    </svg>
  );
}
