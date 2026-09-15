import { DEFAULT_CONFIG } from "@/lib/screening/config";
import type { DevProfile } from "@/lib/screening/developer";
import { screenRows, type ScreeningStats } from "@/lib/screening/ranking";
import { hash32, mulberry32 } from "@/lib/utils";
import { buildUniverse, KOL_NAMES } from "./seed";
import type { DeskToken, FlowEvent, TrendingRow, WalletDossier } from "./types";

const SPARK = 24;

function sparkFrom(price: number, ch1h: number, rng: () => number): number[] {
  const pts = [price];
  let p = price / (1 + ch1h / 100);
  for (let i = 0; i < SPARK - 1; i++) {
    p *= 1 + (rng() - 0.46) * 0.08;
    pts.push(p);
  }
  pts[pts.length - 1] = price;
  return pts;
}

function toDesk(row: TrendingRow, spark: number[]): DeskToken {
  const buys = row.buys;
  const sells = row.sells;
  return {
    address: row.address,
    chain: row.chain,
    symbol: row.symbol,
    name: row.name,
    price: row.price,
    marketCap: row.market_cap,
    volume: row.volume,
    liquidity: row.liquidity,
    ch5m: row.price_change_percent5m,
    ch1h: row.price_change_percent1h,
    buys,
    sells,
    buyRatio: buys + sells > 0 ? buys / (buys + sells) : 0.5,
    holders: row.holder_count,
    createdAt: row.creation_timestamp,
    rugRatio: row.rug_ratio,
    honeypot: row.is_honeypot,
    renouncedMint: row.renounced_mint,
    renouncedFreeze: row.renounced_freeze_account,
    buyTax: row.buy_tax,
    sellTax: row.sell_tax,
    bundler: row.bundler_rate,
    devHold: row.dev_team_hold_rate,
    top10: row.top_10_holder_rate,
    smartDegen: row.smart_degen_count,
    renowned: row.renowned_count,
    sniperCount: row.sniper_count,
    creator: row.creator,
    launchpad: row.launchpad,
    creatorClose: row.creator_close,
    cto: row.cto_flag,
    stage: row.stage ?? "listed",
    progress: row.progress ?? 0,
    complete: row.complete ?? false,
    completeAt: row.completeAt ?? 0,
    openAt: row.openAt ?? 0,
    exchange: row.exchange ?? "",
    rank: 0,
    status: "pending",
    gate: null,
    reasonCode: null,
    reason: null,
    priority: null,
    scoreParts: null,
    verdict: null,
    dev: null,
    spark,
  };
}

function applyScreen(
  rows: TrendingRow[],
  sparks: Record<string, number[]>,
  profiles: Record<string, DevProfile>,
): { tokens: DeskToken[]; stats: ScreeningStats } {
  const result = screenRows(rows, DEFAULT_CONFIG, profiles, "sol");
  const byAddr = new Map(result.candidates.map((c) => [c.features.address, c]));
  const tokens = rows.map((row) => {
    const token = toDesk(row, sparks[row.address] ?? [row.price]);
    const cand = byAddr.get(row.address);
    if (cand) {
      token.rank = cand.rank;
      token.status = cand.status;
      token.gate = cand.gate;
      token.reasonCode = cand.reason_code;
      token.reason = cand.reason;
      token.priority = cand.score_parts ? cand.priority_score : null;
      token.scoreParts = cand.score_parts;
      token.verdict = cand.verdict;
      token.dev = cand.dev;
      token.buyRatio = cand.features.buy_ratio;
    }
    return token;
  });
  tokens.sort((a, b) => (a.rank || 999) - (b.rank || 999));
  return { tokens, stats: result.stats };
}

const FLOW_TYPES: Array<{ type: string; side: FlowEvent["side"]; sm?: boolean; kol?: boolean; large?: boolean }> = [
  { type: "smart_money_buy", side: "buy", sm: true },
  { type: "smart_money_sell", side: "sell", sm: true },
  { type: "kol_buy", side: "buy", kol: true },
  { type: "kol_sell", side: "sell", kol: true },
  { type: "large_buy", side: "buy", large: true },
  { type: "multi_buy", side: "buy" },
  { type: "bundler_sell", side: "sell" },
  { type: "bags_claim", side: "buy" },
  { type: "pump_claim", side: "buy" },
  { type: "price_up", side: "signal" },
  { type: "price_ath", side: "signal" },
  { type: "cto", side: "signal" },
];

function makeEvent(row: TrendingRow, seq: number, rng: () => number): FlowEvent {
  const spec = FLOW_TYPES[Math.floor(rng() * FLOW_TYPES.length)] ?? FLOW_TYPES[0];
  const amount =
    spec.side === "signal" ? null : spec.large ? 8_000 + rng() * 40_000 : 400 + rng() * 12_000;
  return {
    key: `${row.address}-${seq}-${spec.type}`,
    ts: Date.now() / 1000 - rng() * 2,
    chain: "sol",
    event_type: spec.type,
    side: spec.side,
    token_address: row.address,
    symbol: row.symbol,
    amount_usd: amount,
    wallet: spec.side === "signal" ? null : row.creator.replace(/.$/, (c) => (c === "A" ? "B" : "A")),
    kol_username: spec.kol ? KOL_NAMES[Math.floor(rng() * KOL_NAMES.length)] ?? null : null,
    price_usd: row.price,
    market_cap: row.market_cap,
  };
}

export type EngineSnapshot = {
  tokens: DeskToken[];
  events: FlowEvent[];
  stats: ScreeningStats;
  ticks: number;
};

export function createEngine(): {
  snapshot: () => EngineSnapshot;
  tick: () => EngineSnapshot;
  wallet: (address: string) => WalletDossier;
} {
  const { rows, profiles } = buildUniverse(80);
  const sparks: Record<string, number[]> = {};
  for (const row of rows) {
    sparks[row.address] = sparkFrom(row.price, row.price_change_percent1h, mulberry32(hash32(row.address)));
  }

  let ticks = 0;
  let seq = 0;
  const events: FlowEvent[] = [];
  const rng0 = mulberry32(hash32("flow-seed"));
  for (let i = 0; i < 48; i++) {
    const row = rows[Math.floor(rng0() * rows.length)]!;
    events.push(makeEvent(row, seq++, rng0));
  }
  events.sort((a, b) => b.ts - a.ts);

  let { tokens, stats } = applyScreen(rows, sparks, profiles);

  const snapshot = (): EngineSnapshot => ({
    tokens,
    events: events.slice(0, 220),
    stats,
    ticks,
  });

  const tick = (): EngineSnapshot => {
    ticks += 1;
    const rng = mulberry32(hash32(`tick-${ticks}`));
    const n = 6 + Math.floor(rng() * 8);
    for (let i = 0; i < n; i++) {
      const row = rows[Math.floor(rng() * rows.length)]!;
      const drift = (rng() - 0.48) * 0.035;
      row.price = Math.max(row.price * (1 + drift), 1e-9);
      row.market_cap = Math.max(row.market_cap * (1 + drift), 1000);
      row.volume *= 1 + Math.abs(drift) * 0.4;
      row.price_change_percent5m += drift * 80 + (rng() - 0.5) * 0.4;
      row.price_change_percent1h += drift * 30 + (rng() - 0.5) * 0.2;
      if (drift > 0) row.buys += 1;
      else row.sells += 1;
      row.swaps = row.buys + row.sells;
      const spark = sparks[row.address] ?? [row.price];
      spark.push(row.price);
      if (spark.length > SPARK) spark.shift();
      sparks[row.address] = spark;
    }

    if (ticks % 3 === 0) {
      const row = rows[Math.floor(rng() * rows.length)]!;
      events.unshift(makeEvent(row, seq++, rng));
      if (events.length > 400) events.pop();
    }

    if (ticks % 4 === 0) {
      const next = applyScreen(rows, sparks, profiles);
      tokens = next.tokens;
      stats = next.stats;
    } else {
      tokens = tokens.map((t) => {
        const row = rows.find((r) => r.address === t.address);
        if (!row) return t;
        return {
          ...t,
          price: row.price,
          marketCap: row.market_cap,
          volume: row.volume,
          ch5m: row.price_change_percent5m,
          ch1h: row.price_change_percent1h,
          buys: row.buys,
          sells: row.sells,
          buyRatio: row.buys + row.sells > 0 ? row.buys / (row.buys + row.sells) : t.buyRatio,
          spark: sparks[row.address] ?? t.spark,
        };
      });
    }

    return snapshot();
  };

  const wallet = (address: string): WalletDossier => {
    const rng = mulberry32(hash32(`wallet-${address}`));
    const owned = tokens.filter((t) => t.creator === address).slice(0, 6);
    const sample = owned.length ? owned : tokens.slice(0, 4);
    return {
      address,
      name: rng() > 0.55 ? KOL_NAMES[Math.floor(rng() * KOL_NAMES.length)] ?? null : null,
      tags: rng() > 0.5 ? ["smart"] : rng() > 0.5 ? ["sniper"] : ["fresh"],
      realized: (rng() - 0.35) * 180_000,
      unrealized: (rng() - 0.4) * 40_000,
      winrate: pickRange(rng, 0.28, 0.78),
      buyCount: Math.round(pickRange(rng, 20, 420)),
      sellCount: Math.round(pickRange(rng, 10, 380)),
      createdTokenCount: Math.max(owned.length, Math.round(pickRange(rng, 0, 14))),
      launches: sample.map((t) => ({
        address: t.address,
        symbol: t.symbol,
        marketCap: t.marketCap,
        ath: t.marketCap * pickRange(rng, 1.1, 4.2),
        open: t.status === "survivor" || rng() > 0.4,
      })),
      activity: Array.from({ length: 8 }, (_, i) => {
        const t = sample[i % sample.length]!;
        return {
          ts: Date.now() / 1000 - i * 900 - rng() * 400,
          side: rng() > 0.45 ? ("buy" as const) : ("sell" as const),
          symbol: t.symbol,
          amount: pickRange(rng, 200, 18_000),
        };
      }),
    };
  };

  return { snapshot, tick, wallet };
}

function pickRange(rng: () => number, lo: number, hi: number) {
  return lo + rng() * (hi - lo);
}
