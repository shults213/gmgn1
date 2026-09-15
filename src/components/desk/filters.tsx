import { useDesk, visibleTokens } from "@/lib/store";
import type { DeskFeed, DeskFilter } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const FILTERS: { id: DeskFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "survivors", label: "Survivors" },
  { id: "momentum", label: "Momentum" },
  { id: "favorites", label: "Favorites" },
];

const FEEDS: { id: DeskFeed; label: string }[] = [
  { id: "trending", label: "Trend" },
  { id: "new_creation", label: "New" },
  { id: "near_completion", label: "Pre" },
  { id: "completed", label: "Post" },
  { id: "hot_search", label: "Hot" },
];

export function FilterBar() {
  const filter = useDesk((s) => s.filter);
  const setFilter = useDesk((s) => s.setFilter);
  const interval = useDesk((s) => s.interval);
  const platform = useDesk((s) => s.platform);
  const feed = useDesk((s) => s.feed);
  const ranges = useDesk((s) => s.ranges);
  const setInterval = useDesk((s) => s.setInterval);
  const setPlatform = useDesk((s) => s.setPlatform);
  const setFeed = useDesk((s) => s.setFeed);
  const setRange = useDesk((s) => s.setRange);
  const count = useDesk((s) => visibleTokens(s).length);

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2 md:px-3">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setFilter(f.id)}
          className={cn(
            "rounded-sm px-2 py-0.5 text-micro tracking-[0.12em]",
            filter === f.id ? "bg-hover text-gold" : "text-muted hover:text-fg",
          )}
        >
          {f.label}
        </button>
      ))}
      <span className="ml-2 border-l border-line pl-2 text-micro text-faint">FEED</span>
      {FEEDS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setFeed(item.id)}
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-micro tracking-[0.08em] uppercase",
            feed === item.id ? "bg-hover text-gold" : "text-muted hover:text-fg",
          )}
        >
          {item.label}
        </button>
      ))}
      <span className="ml-2 border-l border-line pl-2 text-micro text-faint">TREND</span>
      {(["1m", "5m", "1h", "6h", "24h"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setInterval(value)}
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-micro tracking-[0.1em]",
            interval === value ? "bg-hover text-gold" : "text-muted hover:text-fg",
          )}
        >
          {value}
        </button>
      ))}
      <select
        aria-label="Trending platform"
        value={platform}
        onChange={(event) => setPlatform(event.target.value as typeof platform)}
        className="h-6 rounded-sm border border-line bg-raised px-1 text-micro text-muted outline-none focus:border-gold/50"
      >
        <option value="all">All platforms</option>
        <option value="Pump.fun">Pump.fun</option>
        <option value="letsbonk">letsbonk</option>
        <option value="pump_agent">pump_agent</option>
        <option value="bags">bags</option>
        <option value="Moonshot">Moonshot</option>
      </select>
      <details className="relative ml-1">
        <summary className="cursor-pointer list-none rounded-sm px-1.5 py-0.5 text-micro text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
          FILTERS
        </summary>
        <div className="absolute top-6 left-0 z-20 grid w-72 grid-cols-2 gap-2 rounded-md border border-line bg-surface p-3 shadow-desk">
          <RangeInput label="MC min" value={ranges.minMarketCap} onChange={(value) => setRange("minMarketCap", value)} />
          <RangeInput label="MC max" value={ranges.maxMarketCap} onChange={(value) => setRange("maxMarketCap", value)} />
          <RangeInput label="Liq min" value={ranges.minLiquidity} onChange={(value) => setRange("minLiquidity", value)} />
          <RangeInput label="Vol min" value={ranges.minVolume} onChange={(value) => setRange("minVolume", value)} />
          <RangeInput label="Holders min" value={ranges.minHolders} onChange={(value) => setRange("minHolders", value)} />
          <RangeInput label="5m % min" value={ranges.minChange5m} onChange={(value) => setRange("minChange5m", value)} />
        </div>
      </details>
      <span className="desk-nums ml-auto text-micro text-faint">{count}</span>
    </div>
  );
}

function RangeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-micro text-muted">
      {label}
      <input
        inputMode="decimal"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-7 w-full rounded-sm border border-line bg-raised px-1.5 text-tiny text-fg outline-none focus:border-gold/50"
      />
    </label>
  );
}
