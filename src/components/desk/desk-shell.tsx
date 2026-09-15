import { useEffect, useMemo } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { DeskSnapshot, DeskToken, FlowEvent } from "@/lib/market/types";
import { useDesk } from "@/lib/store";
import { AgentFocus } from "./agent-focus";
import { Dossier } from "./dossier";
import { FilterBar } from "./filters";
import { FlowTape } from "./flow-tape";
import { TokenTable } from "./token-table";
import { Topbar } from "./topbar";
import { WalletPanel } from "./wallet-panel";

export function DeskShell({ initial }: { initial?: DeskSnapshot | null }) {
  const hydrate = useDesk((s) => s.hydrate);
  const ready = useDesk((s) => s.ready);
  const selectedWallet = useDesk((s) => s.selectedWallet);
  const tokens = useDesk((s) => s.tokens);
  const events = useDesk((s) => s.events);
  const selected = useDesk((s) => s.selected);
  const token = useMemo(() => selectedToken(tokens, events, selected), [tokens, events, selected]);
  const mobilePane = useDesk((s) => s.mobilePane);

  useEffect(() => {
    hydrate(initial ?? null);
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (useDesk.getState().cooldownUntil > Date.now() + 2000) return;
      void useDesk.getState().refresh();
    }, 45_000);
    return () => window.clearInterval(t);
  }, [hydrate, initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      const s = useDesk.getState();
      if (e.key === "Escape") {
        s.selectToken(null);
        s.selectWallet(null);
      } else if (e.key === "/" || e.key === "s") {
        e.preventDefault();
        document.getElementById("desk-search")?.focus();
      } else if (e.key === "1") s.setFilter("all");
      else if (e.key === "2") s.setFilter("survivors");
      else if (e.key === "3") s.setFilter("momentum");
      else if (e.key === "4") s.setFilter("favorites");
      else if (e.key === "f" && s.selected) s.toggleFav(s.selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rail = selectedWallet ? (
    <WalletPanel address={selectedWallet} />
  ) : token ? (
    <Dossier token={token} />
  ) : (
    <FlowTape />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <Topbar />
      <div className="flex min-h-0 flex-1">
        <div className="hidden min-h-0 min-w-0 flex-1 md:flex">
          <Group orientation="horizontal" className="h-full w-full">
            <Panel id="scan" defaultSize="72%" minSize="46%" className="h-full overflow-hidden">
              <div className="flex h-full min-h-0 min-w-0 flex-col">
                <FilterBar />
                {ready ? <TokenTable /> : <Loading />}
              </div>
            </Panel>
            <Separator className="w-px bg-line data-[resize-handle-active]:bg-gold data-[resize-handle-hover]:bg-gold/50" />
            <Panel id="rail" defaultSize="28%" minSize="22%" className="h-full overflow-hidden">
              <div className="flex h-full min-h-0 min-w-0 flex-col">
                <AgentFocus />
                <div className="min-h-0 flex-1">{rail}</div>
              </div>
            </Panel>
          </Group>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:hidden">
          {mobilePane === "scan" ? (
            <>
              <FilterBar />
              {ready ? <TokenTable /> : <Loading />}
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <AgentFocus />
              <div className="min-h-0 flex-1">{rail}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function selectedToken(tokens: DeskToken[], events: FlowEvent[], selected: string | null): DeskToken | null {
  if (!selected) return null;
  const token = tokens.find((item) => item.address === selected);
  if (token) return token;

  const event = events.find((item) => item.token_address === selected);
  if (!event) return null;

  return {
    address: event.token_address,
    chain: event.chain,
    symbol: event.symbol,
    name: event.symbol,
    price: event.price_usd ?? 0,
    marketCap: event.market_cap ?? 0,
    volume: event.amount_usd ?? 0,
    liquidity: 0,
    ch5m: 0,
    ch1h: 0,
    buys: event.side === "buy" ? 1 : 0,
    sells: event.side === "sell" ? 1 : 0,
    buyRatio: event.side === "buy" ? 1 : 0,
    holders: 0,
    createdAt: event.ts,
    rugRatio: 0,
    honeypot: false,
    renouncedMint: false,
    renouncedFreeze: false,
    buyTax: 0,
    sellTax: 0,
    bundler: 0,
    devHold: 0,
    top10: 0,
    smartDegen: 0,
    renowned: 0,
    sniperCount: 0,
    creator: event.wallet ?? "",
    launchpad: "Flow event",
    creatorClose: false,
    cto: false,
    stage: "listed",
    progress: 0,
    complete: false,
    completeAt: 0,
    openAt: event.ts,
    exchange: "",
    rank: 0,
    status: "pending",
    gate: null,
    reasonCode: null,
    reason: "Detailed market data is not in the current snapshot.",
    priority: null,
    scoreParts: null,
    verdict: null,
    dev: null,
    spark: [],
  };
}

function Loading() {
  const error = useDesk((s) => s.error);
  const tokens = useDesk((s) => s.tokens);
  if (error && tokens.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
        <div className="text-tiny tracking-[0.16em] text-sell">GMGN OFFLINE</div>
        <p className="max-w-sm text-tiny text-muted">{error}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 items-center justify-center text-tiny tracking-[0.16em] text-muted">
      Fetching Solana universe…
    </div>
  );
}
