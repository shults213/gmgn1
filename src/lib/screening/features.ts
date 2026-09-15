import { clamp } from "@/lib/utils";
import type { MigrationStage, TrendingRow } from "@/lib/market/types";

export { clamp };

export type TokenFeatures = {
  address: string;
  symbol: string;
  name: string;
  price: number;
  mcap: number;
  vol: number;
  age_min: number;
  chg_1h: number;
  chg_5m: number;
  buys: number;
  sells: number;
  swaps: number;
  liquidity: number;
  buy_ratio: number;
  turnover: number;
  honeypot: boolean;
  renounced_mint: boolean;
  renounced_freeze: boolean;
  buy_tax: number;
  sell_tax: number;
  rug_ratio: number;
  bundler: number;
  dev_hold: number;
  top10: number;
  smart_degen: number;
  renowned: number;
  sniper_count: number;
  sm_confluence: number;
  stage: MigrationStage;
  progress: number;
  migrate_age_min: number;
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return ["1", "true", "yes"].includes(v.toLowerCase());
  return false;
}

export function buildFromRow(row: TrendingRow, now = Date.now() / 1000): TokenFeatures {
  const created = num(row.creation_timestamp);
  const age_min = created > 0 ? Math.max(0, (now - created) / 60) : 0;
  const buys = Math.round(num(row.buys));
  const sells = Math.round(num(row.sells));
  const mcap = num(row.market_cap);
  const vol = num(row.volume);
  const degen = Math.round(num(row.smart_degen_count));
  const renowned = Math.round(num(row.renowned_count));

  const complete = num(row.completeAt);
  const migrate_age_min = complete > 0 ? Math.max(0, (now - complete) / 60) : age_min;

  return {
    address: row.address,
    symbol: row.symbol,
    name: row.name,
    price: num(row.price),
    mcap,
    vol,
    age_min,
    chg_1h: num(row.price_change_percent1h) / 100,
    chg_5m: num(row.price_change_percent5m) / 100,
    buys,
    sells,
    swaps: Math.round(num(row.swaps)),
    liquidity: num(row.liquidity),
    buy_ratio: buys + sells > 0 ? buys / (buys + sells) : 0.5,
    turnover: mcap > 0 ? vol / mcap : 0,
    honeypot: bool(row.is_honeypot),
    renounced_mint: bool(row.renounced_mint),
    renounced_freeze: bool(row.renounced_freeze_account),
    buy_tax: num(row.buy_tax),
    sell_tax: num(row.sell_tax),
    rug_ratio: num(row.rug_ratio),
    bundler: num(row.bundler_rate),
    dev_hold: num(row.dev_team_hold_rate),
    top10: num(row.top_10_holder_rate),
    smart_degen: degen,
    renowned,
    sniper_count: Math.round(num(row.sniper_count)),
    sm_confluence: degen + renowned,
    stage: row.stage ?? "listed",
    progress: num(row.progress),
    migrate_age_min,
  };
}
