import { create } from "zustand";
import { fetchDeskSnapshot, fetchWalletDossier } from "@/lib/gmgn/api";
import type { DeskSnapshot } from "@/lib/market/types";
import type {
  DeskFilter,
  DeskToken,
  FlowEvent,
  FlowFilter,
  DeskFeed,
  DeskSource,
  TrendingInterval,
  TrendingPlatform,
  SortKey,
  SortState,
  WalletDossier,
} from "@/lib/market/types";
import type { ScreeningStats } from "@/lib/screening/ranking";
import { EMPTY_AGENT, type AgentState } from "@/lib/agent/types.ts";

const FAV_KEY = "gmgn-desk-favorites";

export type TrendingRanges = {
  minMarketCap: string;
  maxMarketCap: string;
  minLiquidity: string;
  minVolume: string;
  minHolders: string;
  minChange5m: string;
};

function loadFavs(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveFavs(favs: string[]) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  } catch {
    /* ignore quota */
  }
}

type DeskState = {
  ready: boolean;
  live: boolean;
  stale: boolean;
  error: string | null;
  tokens: DeskToken[];
  events: FlowEvent[];
  stats: ScreeningStats | null;
  ticks: number;
  updatedAt: number;
  source: DeskSource;
  cooldownLeft: number;
  cooldownUntil: number;
  banned: boolean;
  agent: AgentState;
  filter: DeskFilter;
  flowFilter: FlowFilter;
  sort: SortState;
  search: string;
  favorites: string[];
  selected: string | null;
  selectedWallet: string | null;
  wallets: Record<string, WalletDossier>;
  walletLoading: string | null;
  walletError: string | null;
  mobilePane: "scan" | "tape";
  interval: TrendingInterval;
  platform: TrendingPlatform;
  feed: DeskFeed;
  ranges: TrendingRanges;
  hydrate: (initial?: DeskSnapshot | null) => void;
  refresh: () => Promise<void>;
  loadWallet: (address: string) => Promise<void>;
  setFilter: (filter: DeskFilter) => void;
  setFlowFilter: (filter: FlowFilter) => void;
  setSort: (key: SortKey) => void;
  setSearch: (q: string) => void;
  toggleFav: (address: string) => void;
  selectToken: (address: string | null) => void;
  selectWallet: (address: string | null) => void;
  setMobilePane: (pane: "scan" | "tape") => void;
  setInterval: (interval: TrendingInterval) => void;
  setPlatform: (platform: TrendingPlatform) => void;
  setFeed: (feed: DeskFeed) => void;
  setRange: (key: keyof TrendingRanges, value: string) => void;
};

let hydrating = false;
let refreshing = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(refresh: () => Promise<void>) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refresh();
  }, 300);
}

export const useDesk = create<DeskState>((set, get) => ({
  ready: false,
  live: false,
  stale: false,
  error: null,
  tokens: [],
  events: [],
  stats: null,
  ticks: 0,
  updatedAt: 0,
  source: "openapi",
  cooldownLeft: 0,
  cooldownUntil: 0,
  banned: false,
  agent: EMPTY_AGENT,
  filter: "all",
  flowFilter: "all",
  sort: { key: "rank", dir: "asc" },
  search: "",
  favorites: [],
  selected: null,
  selectedWallet: null,
  wallets: {},
  walletLoading: null,
  walletError: null,
  mobilePane: "scan",
  interval: "5m",
  platform: "all",
  feed: "trending",
  ranges: {
    minMarketCap: "",
    maxMarketCap: "",
    minLiquidity: "",
    minVolume: "",
    minHolders: "",
    minChange5m: "",
  },
  hydrate: (initial) => {
    if (hydrating) return;
    hydrating = true;
    const favs = loadFavs();
    if (initial && initial.tokens.length > 0) {
      set({
        ready: true,
        favorites: favs,
        live: initial.live,
        stale: initial.stale,
        error: initial.error,
        tokens: initial.tokens,
        events: initial.events,
        stats: initial.stats,
        ticks: initial.ticks,
        updatedAt: initial.updatedAt,
        source: "openapi",
        cooldownLeft: initial.cooldownLeft ?? 0,
        cooldownUntil: initial.cooldownUntil ?? 0,
        banned: initial.banned ?? false,
        agent: initial.agent ?? EMPTY_AGENT,
      });
      return;
    }
    set({
      favorites: favs,
      ready: true,
      error: initial?.error ?? null,
      live: false,
      cooldownLeft: initial?.cooldownLeft ?? 0,
      cooldownUntil: initial?.cooldownUntil ?? 0,
      banned: initial?.banned ?? false,
    });
    if (!initial?.error && !initial?.cooldownLeft) void get().refresh();
  },
  refresh: async () => {
    if (refreshing) return;
    refreshing = true;
    try {
      const snap = await fetchDeskSnapshot({
        data: { feed: get().feed, interval: get().interval, platform: get().platform, pull: true },
      });
      set({
        ready: true,
        live: snap.live,
        stale: snap.stale,
        error: snap.error,
        tokens: snap.tokens,
        events: snap.events,
        stats: snap.stats,
        ticks: snap.ticks,
        updatedAt: snap.updatedAt,
        source: "openapi",
        cooldownLeft: snap.cooldownLeft ?? 0,
        cooldownUntil: snap.cooldownUntil ?? 0,
        banned: snap.banned ?? false,
        agent: snap.agent ?? EMPTY_AGENT,
      });
    } catch (err) {
      set({
        ready: true,
        live: false,
        error: err instanceof Error ? err.message : "GMGN unreachable",
      });
    } finally {
      refreshing = false;
    }
  },
  loadWallet: async (address) => {
    if (get().wallets[address]) return;
    set({ walletLoading: address, walletError: null });
    try {
      const dossier = await fetchWalletDossier({ data: { address } });
      set((s) => ({
        wallets: { ...s.wallets, [address]: dossier },
        walletLoading: null,
      }));
    } catch (err) {
      set({
        walletLoading: null,
        walletError: err instanceof Error ? err.message : "Wallet fetch failed",
      });
    }
  },
  setFilter: (filter) => set({ filter }),
  setFlowFilter: (filter) => set({ flowFilter: filter }),
  setSort: (key) =>
    set((s) => {
      if (s.sort.key === key) {
        return { sort: { key, dir: s.sort.dir === "asc" ? "desc" : "asc" } };
      }
      const dir: "asc" | "desc" = key === "rank" || key === "rug" || key === "age" ? "asc" : "desc";
      return { sort: { key, dir } };
    }),
  setSearch: (q) => set({ search: q }),
  toggleFav: (address) => {
    const next = get().favorites.includes(address)
      ? get().favorites.filter((a) => a !== address)
      : [...get().favorites, address];
    saveFavs(next);
    set({ favorites: next });
  },
  selectToken: (address) =>
    set({
      selected: address,
      selectedWallet: null,
      mobilePane: address ? "tape" : get().mobilePane,
    }),
  selectWallet: (address) => {
    set({ selectedWallet: address, selected: null });
    if (address) void get().loadWallet(address);
  },
  setMobilePane: (pane) => set({ mobilePane: pane }),
  setInterval: (interval) => {
    if (get().interval === interval) return;
    set({ interval });
    scheduleRefresh(() => get().refresh());
  },
  setPlatform: (platform) => {
    if (get().platform === platform) return;
    set({ platform });
    scheduleRefresh(() => get().refresh());
  },
  setFeed: (feed) => {
    if (get().feed === feed) return;
    set({ feed });
    scheduleRefresh(() => get().refresh());
  },
  setRange: (key, value) => set((s) => ({ ranges: { ...s.ranges, [key]: value } })),
}));

export function visibleTokens(state: DeskState): DeskToken[] {
  let list = state.tokens;
  if (state.filter === "survivors") list = list.filter((t) => t.status === "survivor");
  else if (state.filter === "momentum") list = list.filter((t) => t.ch1h > 10);
  else if (state.filter === "favorites") {
    const fav = new Set(state.favorites);
    list = list.filter((t) => fav.has(t.address));
  }
  const q = state.search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q),
    );
  }
  const range = (value: string) => {
    const parsed = Number(value);
    return value.trim() === "" || !Number.isFinite(parsed) ? null : parsed;
  };
  const minMarketCap = range(state.ranges.minMarketCap);
  const maxMarketCap = range(state.ranges.maxMarketCap);
  const minLiquidity = range(state.ranges.minLiquidity);
  const minVolume = range(state.ranges.minVolume);
  const minHolders = range(state.ranges.minHolders);
  const minChange5m = range(state.ranges.minChange5m);
  list = list.filter(
    (t) =>
      (minMarketCap === null || t.marketCap >= minMarketCap) &&
      (maxMarketCap === null || t.marketCap <= maxMarketCap) &&
      (minLiquidity === null || t.liquidity >= minLiquidity) &&
      (minVolume === null || t.volume >= minVolume) &&
      (minHolders === null || t.holders >= minHolders) &&
      (minChange5m === null || t.ch5m >= minChange5m),
  );
  const { key, dir } = state.sort;
  const mul = dir === "asc" ? 1 : -1;
  const val = (t: DeskToken): number => {
    switch (key) {
      case "mc":
        return t.marketCap;
      case "vol":
        return t.volume;
      case "sm":
        return t.smartDegen;
      case "kol":
        return t.renowned;
      case "rug":
        return t.rugRatio;
      case "age":
        return -t.createdAt;
      case "ch5m":
        return t.ch5m;
      case "ch1h":
        return t.ch1h;
      case "dev":
        return t.dev?.score ?? -1;
      case "priority":
        return t.priority ?? -1;
      case "progress":
        return t.progress;
      case "rank":
      default:
        return t.rank || 999;
    }
  };
  return [...list].sort((a, b) => (val(a) - val(b)) * mul);
}

export function visibleEvents(state: DeskState): FlowEvent[] {
  const f = state.flowFilter;
  return state.events.filter((e) => {
    const t = e.event_type;
    if (f === "sm") return t.startsWith("smart_money");
    if (f === "kol") return t.startsWith("kol");
    if (f === "buys") return e.side === "buy" || t.includes("buy") || t.includes("claim");
    if (f === "sells") return e.side === "sell" || t.includes("sell") || t.includes("bundler");
    if (f === "large") return (e.amount_usd ?? 0) >= 10_000 || t.includes("large");
    if (f === "agent") return t.startsWith("agent");
    return true;
  });
}
