import type { FlowEvent, MigrationStage, TrendingRow, WalletDossier } from "@/lib/market/types";

export function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function numOpt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = num(value, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

export function int(value: unknown, fallback = 0): number {
  return Math.round(num(value, fallback));
}

export function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "burn";
  }
  return false;
}

export function str(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export function unwrap(data: unknown): unknown {
  let cur = data;
  for (let i = 0; i < 4; i++) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    if (obj.data !== undefined && typeof obj.data === "object") {
      cur = obj.data;
      continue;
    }
    break;
  }
  return cur;
}

export function asList(data: unknown): Record<string, unknown>[] {
  const inner = unwrap(data);
  if (Array.isArray(inner)) return inner.filter(isRecord);
  if (!inner || typeof inner !== "object") return [];
  const obj = inner as Record<string, unknown>;
  for (const key of [
    "rank",
    "list",
    "tokens",
    "holdings",
    "activities",
    "activity",
    "new_creation",
    "pump",
    "completed",
  ]) {
    if (Array.isArray(obj[key])) return (obj[key] as unknown[]).filter(isRecord);
  }
  return [];
}

export function asHotSearchTokens(data: unknown): Record<string, unknown>[] {
  const inner = unwrap(data);
  if (isRecord(inner) && Array.isArray(inner.tokens)) {
    return (inner.tokens as unknown[]).filter(isRecord);
  }
  if (!Array.isArray(inner)) return [];
  const tokens: Record<string, unknown>[] = [];
  for (const block of inner) {
    if (!isRecord(block)) continue;
    const list = block.tokens;
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      if (isRecord(t)) tokens.push(t);
    }
  }
  return tokens;
}

export function asTrenchesTokens(data: unknown, bucket = "new_creation"): Record<string, unknown>[] {
  const inner = unwrap(data);
  if (Array.isArray(inner)) return inner.filter(isRecord);
  if (!isRecord(inner)) return [];
  const list = inner[bucket] ?? (bucket === "pump" ? inner.near_completion : undefined);
  if (Array.isArray(list)) return list.filter(isRecord);
  return [];
}

export function withStage(
  items: Record<string, unknown>[],
  stage: MigrationStage,
): Record<string, unknown>[] {
  return items.map((item) => ({ ...item, __stage: stage }));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function normalizeTrending(item: Record<string, unknown>): TrendingRow | null {
  const address = str(item.address || item.token_address);
  if (!address) return null;
  const link = isRecord(item.link) ? item.link : null;
  return {
    address,
    chain: str(item.chain) || "sol",
    symbol: str(item.symbol) || "???",
    name: str(item.name) || str(item.symbol) || address.slice(0, 6),
    logo: str(item.logo) || undefined,
    price: num(item.price),
    market_cap: num(item.market_cap ?? item.usd_market_cap),
    liquidity: num(item.liquidity ?? item.pool_liquidity),
    volume: num(item.volume ?? item.volume_1h ?? item.volume_24h),
    price_change_percent5m: num(item.price_change_percent5m ?? item.price_change_percent),
    price_change_percent1h: num(item.price_change_percent1h ?? item.price_change_percent),
    buys: int(item.buys),
    sells: int(item.sells),
    swaps: int(item.swaps),
    holder_count: int(item.holder_count ?? item.holders),
    creation_timestamp: int(
      item.creation_timestamp || item.open_timestamp || item.created_timestamp || item.create_timestamp,
    ),
    rug_ratio: num(item.rug_ratio),
    is_honeypot: bool(item.is_honeypot),
    is_wash_trading: bool(item.is_wash_trading),
    renounced_mint: bool(item.renounced_mint),
    renounced_freeze_account: bool(item.renounced_freeze_account),
    buy_tax: num(item.buy_tax),
    sell_tax: num(item.sell_tax),
    bundler_rate: num(item.bundler_rate),
    dev_team_hold_rate: num(item.dev_team_hold_rate),
    top_10_holder_rate: num(item.top_10_holder_rate),
    smart_degen_count: int(item.smart_degen_count),
    renowned_count: int(item.renowned_count),
    sniper_count: int(item.sniper_count),
    creator: str(item.creator),
    launchpad: str(item.launchpad_platform || item.launchpad),
    twitter: str(item.twitter_username || link?.twitter_username) || undefined,
    website: str(item.website || link?.website) || undefined,
    telegram: str(item.telegram || link?.telegram) || undefined,
    creator_close: bool(item.creator_close) || str(item.creator_token_status) === "creator_close",
    cto_flag: bool(item.cto_flag),
    stage: (["fresh", "pre_mig", "migrated", "listed"] as const).includes(item.__stage as never)
      ? (item.__stage as TrendingRow["stage"])
      : inferStage(item),
    progress: pct01(item.progress ?? item.progress_percent ?? item.bonding_progress),
    complete: bool(item.complete) || int(item.complete_timestamp) > 0,
    completeAt: int(item.complete_timestamp),
    openAt: int(item.open_timestamp),
    exchange: str(item.exchange),
  };
}

function pct01(value: unknown): number {
  const n = num(value);
  if (n <= 0) return 0;
  return n > 1.5 ? Math.min(1, n / 100) : Math.min(1, n);
}

function inferStage(item: Record<string, unknown>): TrendingRow["stage"] {
  if (bool(item.complete) || int(item.complete_timestamp) > 0) return "migrated";
  const progress = pct01(item.progress ?? item.progress_percent ?? item.bonding_progress);
  if (progress >= 0.5) return "pre_mig";
  if (progress > 0) return "fresh";
  return "listed";
}

const NATIVE = new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

export function normalizeTrack(
  item: Record<string, unknown>,
  category: "smart_money" | "kol",
): FlowEvent | null {
  const tx = str(item.transaction_hash);
  const token = str(item.base_address);
  if (!token && !tx) return null;
  if (NATIVE.has(token)) return null;
  const sideRaw = str(item.side);
  const side: FlowEvent["side"] = sideRaw === "sell" ? "sell" : sideRaw === "buy" ? "buy" : "signal";
  const maker = (item.maker_info as Record<string, unknown> | undefined) ?? {};
  const base = (item.base_token as Record<string, unknown> | undefined) ?? {};
  return {
    key: tx || `${category}:${token}:${item.timestamp}:${item.maker}`,
    ts: int(item.timestamp, Math.floor(Date.now() / 1000)),
    chain: str(item.chain) || "sol",
    event_type: side === "signal" ? category : `${category}_${side}`,
    side,
    token_address: token,
    symbol: str(base.symbol) || "???",
    amount_usd: numOpt(item.amount_usd),
    wallet: str(item.maker) || null,
    kol_username: str(maker.twitter_username) || null,
    price_usd: numOpt(item.price_usd ?? item.price),
    market_cap: null,
  };
}

const SIGNAL_NAMES: Record<number, string> = {
  1: "price_motion",
  2: "dex_ad",
  5: "dex_boost",
  6: "price_up",
  7: "price_ath",
  8: "mcp_level",
  9: "live",
  10: "bundler_sell",
  11: "cto",
  12: "smart_money_buy",
  13: "platform_call",
  14: "large_buy",
  15: "multi_buy",
  16: "multi_large_buy",
  17: "bags_claim",
  18: "pump_claim",
  20: "kol_buy",
  21: "banker_claim",
};

export function normalizeSignal(item: Record<string, unknown>): FlowEvent | null {
  const type = int(item.signal_type, -1);
  const token = str(item.token_address);
  if (type < 0 || !token) return null;
  if (NATIVE.has(token)) return null;
  const data = (item.data as Record<string, unknown> | undefined) ?? {};
  const event = SIGNAL_NAMES[type] ?? "signal";
  const side: FlowEvent["side"] =
    event.includes("sell") || event.includes("bundler")
      ? "sell"
      : event.includes("buy") || event.includes("claim")
        ? "buy"
        : "signal";
  return {
    key: str(item.id) || `sig:${token}:${item.trigger_at}:${type}`,
    ts: int(item.trigger_at, Math.floor(Date.now() / 1000)),
    chain: str(data.chain) || "sol",
    event_type: event,
    side,
    token_address: token,
    symbol: str(data.symbol) || "???",
    amount_usd: null,
    wallet: null,
    kol_username: null,
    price_usd: null,
    market_cap: numOpt(item.market_cap),
  };
}

export function parseWallet(
  address: string,
  statsRaw: unknown,
  createdRaw: unknown,
  activityRaw: unknown,
): WalletDossier {
  const stats = unwrap(statsRaw);
  const s = isRecord(stats) ? stats : {};
  const common = isRecord(s.common) ? s.common : {};
  const pnl = isRecord(s.pnl_stat) ? s.pnl_stat : {};
  const created = unwrap(createdRaw);
  const createdObj = isRecord(created) ? created : {};
  const tokens = asList(createdRaw);
  const activity = asList(activityRaw);

  return {
    address,
    name: str(common.twitter_username || common.name || common.nick_name) || null,
    tags: Array.isArray(common.tags) ? common.tags.map(String) : [],
    realized: num(s.realized_profit),
    unrealized: num(s.unrealized_profit),
    winrate: num(pnl.winrate ?? s.winrate),
    buyCount: int(s.buy_count ?? s.buy),
    sellCount: int(s.sell_count ?? s.sell),
    createdTokenCount: int(common.created_token_count ?? createdObj.open_count ?? tokens.length),
    launches: tokens.slice(0, 12).map((t) => ({
      address: str(t.token_address || t.address),
      symbol: str(t.symbol) || "???",
      marketCap: num(t.market_cap),
      ath: num(t.token_ath_mc),
      open: bool(t.is_open),
    })),
    activity: activity
      .filter((a) => {
        const kind = str(a.event_type || a.type || a.side).toLowerCase();
        return kind.includes("buy") || kind.includes("sell");
      })
      .slice(0, 20)
      .map((a) => {
        const token = isRecord(a.token) ? a.token : a;
        const kind = str(a.event_type || a.type || a.side).toLowerCase();
        return {
          ts: int(a.timestamp || a.block_unix_time),
          side: kind.includes("sell") ? ("sell" as const) : ("buy" as const),
          symbol: str(token.symbol || a.symbol) || "???",
          amount: num(a.cost_usd ?? a.amount_usd ?? a.buy_cost_usd),
        };
      }),
  };
}
