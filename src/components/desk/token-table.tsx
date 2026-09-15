import { useShallow } from "zustand/react/shallow";
import { Star } from "lucide-react";
import { formatChange, formatPrice, formatUsd, rugTone, scoreTone, timeAgo } from "@/lib/format";
import type { DeskToken, SortKey } from "@/lib/market/types";
import { REJECT_LABEL } from "@/lib/screening/gates";
import { useDesk, visibleTokens } from "@/lib/store";
import { cn } from "@/lib/utils";
import { TokenMark, Tone } from "./mark";

const COLS: { key: SortKey | null; label: string; cls: string; hide?: string }[] = [
  { key: null, label: "", cls: "w-7" },
  { key: "rank", label: "#", cls: "w-8 text-right hidden sm:table-cell" },
  { key: null, label: "Token", cls: "min-w-36 text-left" },
  { key: null, label: "Price", cls: "text-right hidden sm:table-cell" },
  { key: "mc", label: "MC", cls: "text-right hidden sm:table-cell" },
  { key: "ch5m", label: "5m", cls: "text-right" },
  { key: "ch1h", label: "1h", cls: "text-right hidden md:table-cell" },
  { key: null, label: "Buy", cls: "text-right hidden lg:table-cell" },
  { key: "vol", label: "Vol", cls: "text-right hidden lg:table-cell" },
  { key: "rug", label: "Rug", cls: "text-right hidden xl:table-cell" },
  { key: "sm", label: "SM", cls: "text-right hidden xl:table-cell" },
  { key: "kol", label: "KOL", cls: "text-right hidden xl:table-cell" },
  { key: "dev", label: "Dev", cls: "text-right hidden lg:table-cell" },
  { key: "priority", label: "Pri", cls: "text-right" },
  { key: null, label: "Status", cls: "text-left hidden sm:table-cell" },
];

export function TokenTable() {
  const tokens = useDesk((s) => s.tokens);
  const favorites = useDesk((s) => s.favorites);
  const selected = useDesk((s) => s.selected);
  const selectToken = useDesk((s) => s.selectToken);
  const toggleFav = useDesk((s) => s.toggleFav);
  const setSort = useDesk((s) => s.setSort);
  const sort = useDesk((s) => s.sort);
  const error = useDesk((s) => s.error);

  const list = useDesk(useShallow((s) => visibleTokens(s)));

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      <table className="w-full text-tiny">
        <thead className="sticky top-0 z-10 bg-bg">
          <tr className="text-micro tracking-[0.12em] text-faint">
            {COLS.map((c) => (
              <th
                key={c.label + c.cls}
                className={cn(
                  "border-b border-line px-1.5 py-1.5 font-medium",
                  c.cls,
                  c.key && "cursor-pointer select-none hover:text-muted",
                )}
                onClick={() => c.key && setSort(c.key)}
              >
                {c.label}
                {c.key && sort.key === c.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td colSpan={COLS.length} className="px-4 py-16 text-center text-muted">
                {error && tokens.length === 0
                  ? error
                  : tokens.length === 0
                    ? "No tokens in this feed right now."
                    : "No tokens match this filter."}
              </td>
            </tr>
          ) : (
            list.map((t) => (
              <Row
                key={t.address}
                token={t}
                selected={selected === t.address}
                fav={favorites.includes(t.address)}
                onSelect={() => selectToken(t.address)}
                onFav={() => toggleFav(t.address)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  token: t,
  selected,
  fav,
  onSelect,
  onFav,
}: {
  token: DeskToken;
  selected: boolean;
  fav: boolean;
  onSelect: () => void;
  onFav: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={cn(
        "cursor-pointer hover:bg-hover/70",
        selected ? "bg-hover desk-row-sel" : "",
      )}
    >
      <td className="px-1 py-1">
        <button
          type="button"
          aria-label={fav ? "Remove favorite" : "Add favorite"}
          onClick={(e) => {
            e.stopPropagation();
            onFav();
          }}
          className="relative grid size-6 place-items-center"
        >
          <Star
            className={cn("size-3.5", fav ? "fill-gold text-gold" : "text-faint")}
            strokeWidth={1.6}
          />
          <WatchDot address={t.address} />
        </button>
      </td>
      <td className="desk-nums hidden px-1.5 text-right text-faint sm:table-cell">{t.rank || "—"}</td>
      <td className="px-1.5 py-1">
        <div className="flex items-center gap-2">
          <TokenMark symbol={t.symbol} logo={t.logo} />
          <div className="min-w-0 leading-tight">
            <div className="flex items-baseline gap-1.5">
              <span className="font-medium text-fg">{t.symbol}</span>
              <StageBadge token={t} />
              <span className="truncate text-micro text-faint">{t.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-micro text-faint sm:inline">
                {t.stage === "migrated" && t.completeAt ? timeAgo(t.completeAt) : timeAgo(t.createdAt)}
              </span>
              {t.stage === "pre_mig" || (t.progress > 0 && t.progress < 1) ? (
                <CurveBar progress={t.progress} />
              ) : null}
            </div>
          </div>
        </div>
      </td>
      <td className="desk-nums hidden px-1.5 text-right text-fg sm:table-cell">{formatPrice(t.price)}</td>
      <td className="desk-nums hidden px-1.5 text-right sm:table-cell">{formatUsd(t.marketCap)}</td>
      <td className="px-1.5 text-right">
        <Tone tone={t.ch5m >= 0 ? "buy" : "sell"}>{formatChange(t.ch5m)}</Tone>
      </td>
      <td className="hidden px-1.5 text-right md:table-cell">
        <Tone tone={t.ch1h >= 0 ? "buy" : "sell"}>{formatChange(t.ch1h)}</Tone>
      </td>
      <td className="hidden px-1.5 text-right lg:table-cell">
        <Tone tone={t.buyRatio >= 0.5 ? "buy" : t.buyRatio < 0.42 ? "sell" : "warn"}>
          {Math.round(t.buyRatio * 100)}%
        </Tone>
      </td>
      <td className="desk-nums hidden px-1.5 text-right lg:table-cell">{formatUsd(t.volume)}</td>
      <td className="hidden px-1.5 text-right xl:table-cell">
        <Tone tone={rugTone(t.rugRatio)}>{Math.round(t.rugRatio * 100)}%</Tone>
      </td>
      <td className="desk-nums hidden px-1.5 text-right xl:table-cell">{t.smartDegen}</td>
      <td className="desk-nums hidden px-1.5 text-right text-steel xl:table-cell">{t.renowned}</td>
      <td className="hidden px-1.5 text-right lg:table-cell">
        {t.dev?.score == null ? (
          <span className="text-faint">—</span>
        ) : (
          <Tone tone={scoreTone(Math.round(t.dev.score * 100))}>
            {Math.round(t.dev.score * 100)}
          </Tone>
        )}
      </td>
      <td className="px-1.5 text-right">
        {t.priority == null ? (
          <span className="text-faint">—</span>
        ) : (
          <Tone tone={scoreTone(t.priority)}>{t.priority}</Tone>
        )}
      </td>
      <td className="hidden px-1.5 sm:table-cell">
        <Status token={t} />
      </td>
    </tr>
  );
}

function WatchDot({ address }: { address: string }) {
  const kind = useDesk((s) => s.agent.focus.find((f) => f.address === address)?.kind);
  if (!kind) return null;
  return (
    <i
      className={cn(
        "absolute top-0.5 right-0.5 size-1.5 rounded-full",
        kind === "alert" ? "bg-gold" : kind === "drop" ? "bg-sell" : "bg-steel",
      )}
    />
  );
}

function StageBadge({ token }: { token: DeskToken }) {
  if (token.stage === "pre_mig") {
    return <span className="text-micro tracking-[0.08em] text-gold">PRE</span>;
  }
  if (token.stage === "migrated") {
    return <span className="text-micro tracking-[0.08em] text-buy">POST</span>;
  }
  if (token.stage === "fresh") {
    return <span className="text-micro tracking-[0.08em] text-steel">NEW</span>;
  }
  return null;
}

function CurveBar({ progress }: { progress: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <span className="inline-flex items-center gap-1 text-micro text-gold-dim">
      <span className="h-1 w-10 overflow-hidden rounded-full bg-raised">
        <span className="block h-1 bg-gold" style={{ width: `${pct}%` }} />
      </span>
      {pct}%
    </span>
  );
}

function Status({ token }: { token: DeskToken }) {
  if (token.status === "survivor") {
    const extra =
      token.verdict?.crowdedness && token.verdict.crowdedness !== "early"
        ? ` · ${token.verdict.crowdedness}`
        : "";
    return (
      <span className="rounded-sm border border-buy/30 px-1.5 py-0.5 text-micro tracking-[0.1em] text-buy">
        PASS{extra}
      </span>
    );
  }
  const label = (token.reasonCode && REJECT_LABEL[token.reasonCode]) || "REJECT";
  return (
    <span
      className="rounded-sm border border-line px-1.5 py-0.5 text-micro tracking-[0.08em] text-muted"
      title={token.reason ?? undefined}
    >
      {label}
    </span>
  );
}
