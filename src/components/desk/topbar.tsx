import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { formatClock } from "@/lib/format";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Topbar() {
  const stats = useDesk((s) => s.stats);
  const search = useDesk((s) => s.search);
  const setSearch = useDesk((s) => s.setSearch);
  const mobilePane = useDesk((s) => s.mobilePane);
  const setMobilePane = useDesk((s) => s.setMobilePane);

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-3 md:px-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 items-center justify-center rounded-sm bg-gold text-micro font-semibold text-bg">
          G
        </span>
        <div className="hidden leading-none sm:block">
          <div className="text-tiny font-medium tracking-[0.18em] text-fg">GMGN</div>
          <div className="text-micro tracking-[0.22em] text-gold-dim">DESK</div>
        </div>
      </div>

      <span className="rounded-sm border border-line px-1.5 py-0.5 text-micro font-medium tracking-[0.14em] text-gold">
        SOL
      </span>

      <label className="relative min-w-0 flex-1 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" />
        <input
          id="desk-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Symbol / name / address"
          className="h-7 w-full rounded-sm border border-line bg-raised pr-2 pl-7 text-tiny text-fg outline-none placeholder:text-faint focus:border-gold/50"
        />
      </label>

      <Funnel stats={stats} />

      <div className="ml-auto hidden items-center gap-3 md:flex">
        <AgentPill />
        <LivePill />
        <StatusPopover />
        <ClockFace />
      </div>

      <div className="ml-auto flex rounded-sm border border-line md:hidden">
        {(["scan", "tape"] as const).map((pane) => (
          <button
            key={pane}
            type="button"
            onClick={() => setMobilePane(pane)}
            className={cn(
              "px-2.5 py-1 text-micro tracking-[0.14em]",
              mobilePane === pane ? "bg-raised text-gold" : "text-muted",
            )}
          >
            {pane === "scan" ? "SCAN" : "TAPE"}
          </button>
        ))}
      </div>
    </header>
  );
}

function ClockFace() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="desk-nums text-tiny text-muted">
      {now ? formatClock(new Date(now)) : "--:--:--"}
    </span>
  );
}

function Funnel({
  stats,
}: {
  stats: { universe: number; gate1_survivors: number; gate2_survivors: number; signal_survivors: number } | null;
}) {
  if (!stats) return null;
  const steps = [
    { n: stats.universe, label: "UNI" },
    { n: stats.gate1_survivors, label: "RISK" },
    { n: stats.gate2_survivors, label: "CONS" },
    { n: stats.signal_survivors, label: "PASS" },
  ];
  return (
    <div
      className="hidden items-baseline gap-1.5 lg:flex"
      title="AITRADER funnel: universe → risk gates → consensus → signal survivors"
    >
      {steps.map((s, i) => (
        <span key={s.label} className="flex items-baseline gap-1.5">
          {i > 0 ? <span className="text-faint">→</span> : null}
          <span className={cn("desk-nums text-tiny", i === 3 ? "text-gold" : "text-fg")}>{s.n}</span>
          <span className="text-micro tracking-[0.12em] text-faint">{s.label}</span>
        </span>
      ))}
    </div>
  );
}

function AgentPill() {
  const focus = useDesk((s) => s.agent.focus);
  const alert = focus.some((c) => c.kind === "alert");
  return (
    <span className="flex items-center gap-1.5 text-micro tracking-[0.12em] text-muted">
      <i className={cn("size-1.5 rounded-full", alert ? "bg-gold" : focus.length ? "bg-steel" : "bg-faint")} />
      {focus.length ? `AGENT ${focus.length}` : "AGENT"}
    </span>
  );
}

function LivePill() {
  const live = useDesk((s) => s.live);
  const stale = useDesk((s) => s.stale);
  const error = useDesk((s) => s.error);
  const tokens = useDesk((s) => s.tokens.length);
  const cooldownUntil = useDesk((s) => s.cooldownUntil);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);
  const cool = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const mm = String(Math.floor(cool / 60)).padStart(1, "0");
  const ss = String(cool % 60).padStart(2, "0");
  const cached = cool > 0 && tokens > 0;
  const ok = live && tokens > 0 && cool === 0;
  const label = cool > 0 && !tokens ? `COOL ${mm}:${ss}` : cached ? `HOLD ${mm}:${ss}` : !ok && error ? "ERR" : stale ? "STALE" : ok ? "LIVE" : "WAIT";
  const tone = cool > 0 ? "bg-gold" : !ok && error ? "bg-sell" : stale ? "bg-gold" : ok ? "bg-buy" : "bg-faint";
  return (
    <span className="flex items-center gap-1.5 text-micro tracking-[0.12em] text-muted">
      <i className={cn("size-1.5 rounded-full", tone)} />
      {label}
    </span>
  );
}

function StatusPopover() {
  const ticks = useDesk((s) => s.ticks);
  const error = useDesk((s) => s.error);
  const stale = useDesk((s) => s.stale);
  const updatedAt = useDesk((s) => s.updatedAt);
  const tokens = useDesk((s) => s.tokens.length);
  const cooldownLeft = useDesk((s) => s.cooldownLeft);
  const banned = useDesk((s) => s.banned);
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-micro tracking-[0.12em] text-muted [&::-webkit-details-marker]:hidden">
        <i className="size-1.5 rounded-full bg-gold" />
        FEED
      </summary>
      <div className="absolute top-6 right-0 z-30 w-64 rounded-md border border-line bg-surface p-3 shadow-desk">
        <div className="mb-2 text-micro tracking-[0.16em] text-gold-dim">RUNTIME</div>
        <dl className="space-y-1.5 text-tiny">
          <Row k="Chain" v="sol" />
          <Row k="Source" v="GMGN OpenAPI" />
          <Row k="Plan" v="Free · weight 5" />
          <Row k="Budget" v="calls/s = 5 / API weight" />
          <Row k="Universe" v={String(tokens)} />
          <Row k="Screening" v="AITRADER · no LLM" />
          <Row k="Cycles" v={String(ticks)} />
          <Row k="Updated" v={updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—"} />
          <Row k="State" v={banned ? "banned" : cooldownLeft ? `cool ${cooldownLeft}s` : error ? "error" : stale ? "stale" : "live"} />
        </dl>
        {error ? <p className="mt-2 text-micro leading-snug text-sell">{error}</p> : null}
        <p className="mt-2 text-micro leading-snug text-faint">
          Rank (w1) ≤ 5/s, trenches/hot (w3) ≤ 1.6/s, holders (w5) ≤ 1/s. Board every 15s, tape every 90s. Banned never retried.
        </p>
      </div>
    </details>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="desk-nums text-fg">{v}</dd>
    </div>
  );
}
