export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 1) return `$${n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  const exp = Math.floor(Math.log10(n));
  const decimals = Math.min(Math.max(-exp + 2, 4), 10);
  return `$${n.toFixed(decimals)}`;
}

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${compact(n)}`;
}

export function formatChange(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function formatPct(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function shortAddr(addr: string | null | undefined, head = 4, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function formatClock(date: Date): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

export function scoreTone(score: number | null | undefined): "buy" | "warn" | "sell" | "muted" {
  if (score == null) return "muted";
  if (score >= 70) return "buy";
  if (score >= 45) return "warn";
  return "sell";
}

export function rugTone(rug: number | null | undefined): "buy" | "warn" | "sell" | "muted" {
  if (rug == null) return "muted";
  if (rug < 0.15) return "buy";
  if (rug <= 0.3) return "warn";
  return "sell";
}
