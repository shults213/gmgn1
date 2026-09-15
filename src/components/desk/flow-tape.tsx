import { useShallow } from "zustand/react/shallow";
import { formatUsd, shortAddr, timeAgo } from "@/lib/format";
import type { FlowEvent } from "@/lib/market/types";
import { useDesk, visibleEvents } from "@/lib/store";
import { cn } from "@/lib/utils";

const FLOW_FILTERS = [
  { id: "all", label: "ALL" },
  { id: "sm", label: "SM" },
  { id: "kol", label: "KOL" },
  { id: "buys", label: "BUYS" },
  { id: "sells", label: "SELLS" },
  { id: "large", label: "LARGE" },
  { id: "agent", label: "AGENT" },
] as const;

function eventTone(e: FlowEvent): string {
  const t = e.event_type;
  if (t.startsWith("agent_alert")) return "text-gold";
  if (t.startsWith("agent_drop")) return "text-sell";
  if (t.startsWith("agent")) return "text-steel";
  if (t.startsWith("kol_")) return "text-steel";
  if (t.includes("sell") || t.includes("bundler")) return "text-sell";
  if (t.includes("buy") || t.includes("claim")) return "text-buy";
  if (t.startsWith("price") || t.includes("mcp")) return "text-gold";
  return "text-muted";
}

function typeLabel(t: string) {
  return t.replace(/_/g, " ").toUpperCase();
}

export function FlowTape() {
  const flowFilter = useDesk((s) => s.flowFilter);
  const setFlowFilter = useDesk((s) => s.setFlowFilter);
  const selectToken = useDesk((s) => s.selectToken);
  const selectWallet = useDesk((s) => s.selectWallet);
  const events = useDesk(useShallow((s) => visibleEvents(s)));

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-2">
        <span className="mr-1 text-micro tracking-[0.16em] text-gold-dim">FLOW</span>
        {FLOW_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFlowFilter(f.id)}
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-micro tracking-[0.1em]",
              flowFilter === f.id ? "bg-hover text-fg" : "text-faint hover:text-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="px-3 py-10 text-center text-tiny text-muted">No flow events.</div>
        ) : (
          events.slice(0, 160).map((e) => (
            <div
              key={e.key}
              role="button"
              tabIndex={0}
              onClick={() => selectToken(e.token_address)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  selectToken(e.token_address);
                }
              }}
              className="flex w-full cursor-pointer items-baseline gap-2 border-b border-line/70 px-2 py-1.5 text-left hover:bg-hover"
            >
              <span className={cn("w-24 shrink-0 text-micro tracking-[0.06em]", eventTone(e))}>
                {typeLabel(e.event_type)}
              </span>
              <span className="w-12 shrink-0 text-tiny font-medium text-fg">{e.symbol}</span>
              {e.kol_username ? (
                <span className="hidden text-micro text-steel xl:inline">@{e.kol_username}</span>
              ) : null}
              <span className={cn("desk-nums ml-auto text-tiny", eventTone(e))}>
                {e.amount_usd != null ? formatUsd(e.amount_usd) : ""}
              </span>
              {e.wallet ? (
                <button
                  type="button"
                  className="hidden text-micro text-faint hover:text-gold lg:inline"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    selectWallet(e.wallet);
                  }}
                >
                  {shortAddr(e.wallet, 3, 3)}
                </button>
              ) : null}
              <span className="desk-nums w-8 shrink-0 text-right text-micro text-faint">
                {timeAgo(e.ts)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
