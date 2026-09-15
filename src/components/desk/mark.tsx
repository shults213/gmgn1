import { useState, type ReactNode } from "react";
import { proxiedLogo } from "@/lib/links";
import { cn, hash32 } from "@/lib/utils";

export function TokenMark({
  symbol,
  logo,
  className,
}: {
  symbol: string;
  logo?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const h = hash32(symbol || "?");
  const hue = 28 + (h % 40);
  const letters = (symbol || "?").slice(0, 2).toUpperCase();
  const src = !failed ? proxiedLogo(logo) : null;

  return (
    <span
      className={cn(
        "relative inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-sm text-micro font-medium tracking-wide text-fg/90",
        className,
      )}
      style={{
        background: `hsl(${hue} 18% 16%)`,
        boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--color-fg) 10%, transparent)",
      }}
      aria-hidden
    >
      {loaded ? null : letters}
      {src ? (
        <img
          src={src}
          alt=""
          className={cn(
            "absolute inset-0 size-full object-cover",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

export function Tone({
  tone,
  children,
  className,
}: {
  tone: "buy" | "sell" | "warn" | "muted" | "gold" | "fg";
  children: ReactNode;
  className?: string;
}) {
  const map = {
    buy: "text-buy",
    sell: "text-sell",
    warn: "text-warn",
    muted: "text-muted",
    gold: "text-gold",
    fg: "text-fg",
  } as const;
  return <span className={cn("desk-nums", map[tone], className)}>{children}</span>;
}
