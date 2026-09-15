import { cn } from "@/lib/utils";

export function Sparkline({
  points,
  className,
}: {
  points: number[];
  className?: string;
}) {
  if (points.length < 2) return <span className="text-faint">—</span>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 72;
  const h = 22;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const up = points[points.length - 1]! >= points[0]!;
  return (
    <span className={cn("inline-flex h-8 w-28 shrink-0 overflow-hidden", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
        <path
          d={d}
          fill="none"
          stroke={up ? "var(--color-buy)" : "var(--color-sell)"}
          strokeWidth="1.25"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
