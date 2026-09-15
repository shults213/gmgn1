import type { PublicDev } from "@/lib/screening/developer";
import type { ScreeningStats } from "@/lib/screening/ranking";
import type { MomentumVerdict, ScoreBreakdown } from "@/lib/screening/scoring";
import type { AgentState } from "@/lib/agent/types.ts";

export type TrendingRow = {
  address: string;
  chain: string;
  symbol: string;
  name: string;
  logo?: string;
  price: number;
  market_cap: number;
  liquidity: number;
  volume: number;
  price_change_percent5m: number;
  price_change_percent1h: number;
  buys: number;
  sells: number;
  swaps: number;
  holder_count: number;
  creation_timestamp: number;
  rug_ratio: number;
  is_honeypot: boolean;
  is_wash_trading: boolean;
  renounced_mint: boolean;
  renounced_freeze_account: boolean;
  buy_tax: number;
  sell_tax: number;
  bundler_rate: number;
  dev_team_hold_rate: number;
  top_10_holder_rate: number;
  smart_degen_count: number;
  renowned_count: number;
  sniper_count: number;
  creator: string;
  launchpad: string;
  twitter?: string;
  website?: string;
  telegram?: string;
  creator_close: boolean;
  cto_flag: boolean;
  stage: MigrationStage;
  progress: number;
  complete: boolean;
  completeAt: number;
  openAt: number;
  exchange: string;
};

export type DeskToken = {
  address: string;
  chain: string;
  symbol: string;
  name: string;
  logo?: string;
  price: number;
  marketCap: number;
  volume: number;
  liquidity: number;
  ch5m: number;
  ch1h: number;
  buys: number;
  sells: number;
  buyRatio: number;
  holders: number;
  createdAt: number;
  rugRatio: number;
  honeypot: boolean;
  renouncedMint: boolean;
  renouncedFreeze: boolean;
  buyTax: number;
  sellTax: number;
  bundler: number;
  devHold: number;
  top10: number;
  smartDegen: number;
  renowned: number;
  sniperCount: number;
  creator: string;
  launchpad: string;
  twitter?: string;
  website?: string;
  telegram?: string;
  creatorClose: boolean;
  cto: boolean;
  stage: MigrationStage;
  progress: number;
  complete: boolean;
  completeAt: number;
  openAt: number;
  exchange: string;
  rank: number;
  status: "survivor" | "rejected" | "pending";
  gate: number | null;
  reasonCode: string | null;
  reason: string | null;
  priority: number | null;
  scoreParts: ScoreBreakdown | null;
  verdict: MomentumVerdict | null;
  dev: PublicDev | null;
  spark: number[];
};

export type FlowEvent = {
  key: string;
  ts: number;
  chain: string;
  event_type: string;
  side: "buy" | "sell" | "signal";
  token_address: string;
  symbol: string;
  amount_usd: number | null;
  wallet: string | null;
  kol_username: string | null;
  price_usd: number | null;
  market_cap: number | null;
};

export type WalletDossier = {
  address: string;
  name: string | null;
  tags: string[];
  realized: number;
  unrealized: number;
  winrate: number;
  buyCount: number;
  sellCount: number;
  createdTokenCount: number;
  launches: Array<{
    address: string;
    symbol: string;
    marketCap: number;
    ath: number;
    open: boolean;
  }>;
  activity: Array<{
    ts: number;
    side: "buy" | "sell";
    symbol: string;
    amount: number;
  }>;
};

export type DeskFilter = "all" | "survivors" | "momentum" | "favorites";
export type DeskFeed = "trending" | "new_creation" | "near_completion" | "completed" | "hot_search";
export type MigrationStage = "fresh" | "pre_mig" | "migrated" | "listed";
export type TrendingInterval = "1m" | "5m" | "1h" | "6h" | "24h";
export type TrendingPlatform = "all" | "Pump.fun" | "letsbonk" | "pump_agent" | "bags" | "Moonshot";
export type FlowFilter = "all" | "sm" | "kol" | "buys" | "sells" | "large" | "agent";
export type SortKey =
  | "rank"
  | "priority"
  | "vol"
  | "mc"
  | "ch5m"
  | "ch1h"
  | "sm"
  | "kol"
  | "dev"
  | "rug"
  | "age"
  | "progress";

export type DeskSource = "openapi";

export type SortState = { key: SortKey; dir: "asc" | "desc" };

export type DeskSnapshot = {
  tokens: DeskToken[];
  events: FlowEvent[];
  stats: ScreeningStats | null;
  live: boolean;
  stale: boolean;
  error: string | null;
  updatedAt: number;
  ticks: number;
  source: DeskSource;
  cooldownLeft: number;
  cooldownUntil: number;
  banned: boolean;
  agent: AgentState;
};

export type { ScreeningStats };
