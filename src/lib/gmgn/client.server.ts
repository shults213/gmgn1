import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_CONFIG } from "@/lib/screening/config";
import { emptyDev, type DevProfile } from "@/lib/screening/developer";
import { buildFromRow } from "@/lib/screening/features";
import { hardGates } from "@/lib/screening/gates";
import { screenRows, type ScreeningStats } from "@/lib/screening/ranking";
import { scoreComponents } from "@/lib/screening/scoring";
import type {
  DeskSnapshot,
  DeskSource,
  DeskToken,
  FlowEvent,
  TrendingInterval,
  TrendingPlatform,
  TrendingRow,
  WalletDossier,
} from "@/lib/market/types";
import type { DeskFeed } from "@/lib/market/types";
import {
  asHotSearchTokens,
  asList,
  asTrenchesTokens,
  bool,
  int,
  num,
  numOpt,
  normalizeSignal,
  normalizeTrack,
  normalizeTrending,
  parseWallet,
  str,
  unwrap,
  withStage,
} from "./parse";
import { buildMarketFeedQuery, isTrenchesFeed, TRENCH_BUCKET, TRENCH_FEEDS } from "./query.ts";
import { officialCanCall, officialRequest, officialStatus } from "./http.server.ts";
import { agentSnapshot, runAgent } from "@/lib/agent/runtime.server.ts";
import type { AgentCard } from "@/lib/agent/types.ts";

export { buildMarketFeedQuery } from "./query";

const CHAIN = "sol";
const TRENDING_TTL_MS = 45_000;
const FLOW_TTL_MS = 120_000;
const WALLET_TTL_MS = 120_000;
const SPARK = 24;
const EVENT_CAP = 400;
const DEV_TTL_MS = 600_000;
const DEV_SEC_SCAN_N = 3;
const BOARD_FILE = "/tmp/gmgn-desk-boards.json";
const BOARD_CAP = 24;

export type { MarketFeedRequest } from "./query";

type CacheEntry<T> = { at: number; value: T };

type Board = {
  key: string;
  feed: DeskFeed;
  interval: TrendingInterval;
  platform: TrendingPlatform;
  tokens: DeskToken[];
  stats: ScreeningStats | null;
  at: number;
};

function boardKey(feed: DeskFeed, interval: TrendingInterval, platform: TrendingPlatform) {
  return `${feed}|${interval}|${platform}`;
}

function loadBoards(): Map<string, Board> {
  try {
    const raw = JSON.parse(readFileSync(BOARD_FILE, "utf8")) as Board[];
    const map = new Map<string, Board>();
    for (const b of raw) {
      if (b?.key && Array.isArray(b.tokens)) map.set(b.key, b);
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveBoards() {
  try {
    writeFileSync(BOARD_FILE, JSON.stringify([...boards.values()]));
  } catch {
    /* ignore */
  }
}

async function gmgn(
  method: "GET" | "POST",
  path: string,
  weight: number,
  query: Record<string, string | number | string[] | undefined> = {},
  body: unknown = null,
): Promise<unknown> {
  return officialRequest(method, path, weight, query, body);
}

type Mem = {
  tokens: DeskToken[];
  events: FlowEvent[];
  stats: ScreeningStats | null;
  sparks: Record<string, number[]>;
  seen: Set<string>;
  lastTrending: number;
  interval: TrendingInterval;
  platform: TrendingPlatform;
  feed: DeskFeed;
  lastSm: number;
  lastKol: number;
  lastSignal: number;
  lastOk: number;
  lastError: string | null;
  ticks: number;
  source: DeskSource;
};

const mem: Mem = {
  tokens: [],
  events: [],
  stats: null,
  sparks: {},
  seen: new Set(),
  lastTrending: 0,
  interval: "5m",
  platform: "all",
  feed: "trending",
  lastSm: 0,
  lastKol: 0,
  lastSignal: 0,
  lastOk: 0,
  lastError: null,
  ticks: 0,
  source: "openapi",
};

const boards = loadBoards();
let wanted: { interval: TrendingInterval; platform: TrendingPlatform; feed: DeskFeed } | null = null;
let running: Promise<void> | null = null;

function showBoard(b: Board) {
  mem.tokens = b.tokens;
  mem.stats = b.stats;
  mem.feed = b.feed;
  mem.interval = b.interval;
  mem.platform = b.platform;
  mem.lastTrending = b.at;
  if (b.at > mem.lastOk) mem.lastOk = b.at;
}

function snapshotFor(key: string): DeskSnapshot {
  const b = boards.get(key);
  if (b) showBoard(b);
  return snapshot();
}

function tapeDue(now: number) {
  return now - mem.lastSm >= FLOW_TTL_MS || now - mem.lastKol >= FLOW_TTL_MS || now - mem.lastSignal >= FLOW_TTL_MS;
}

function snapshot(): DeskSnapshot {
  const now = Date.now();
  const st = officialStatus();
  const stale = mem.lastOk > 0 && now - mem.lastOk > TRENDING_TTL_MS * 3;
  const cooling = st.cooldownLeft > 0;
  return {
    tokens: mem.tokens,
    events: mem.events,
    stats: mem.stats,
    live: mem.lastOk > 0 && !stale && mem.tokens.length > 0 && !cooling,
    stale: stale || (cooling && mem.tokens.length > 0),
    error: mem.tokens.length && !st.banned ? null : mem.lastError,
    updatedAt: mem.lastOk,
    ticks: mem.ticks,
    source: "openapi",
    cooldownLeft: st.cooldownLeft,
    cooldownUntil: st.cooldownLeft ? now + st.cooldownLeft * 1000 : 0,
    banned: st.banned,
    agent: agentSnapshot(),
  };
}

function collectTokens(): DeskToken[] {
  const rank: Record<string, number> = { pre_mig: 4, migrated: 3, fresh: 2, listed: 1 };
  const map = new Map<string, DeskToken>();
  for (const b of boards.values()) {
    for (const t of b.tokens) {
      const cur = map.get(t.address);
      if (!cur || (rank[t.stage] ?? 0) >= (rank[cur.stage] ?? 0)) map.set(t.address, t);
    }
  }
  return [...map.values()];
}

function agentEvent(card: AgentCard): FlowEvent {
  return {
    key: `agent:${card.kind}:${card.address}:${card.ts}`,
    ts: Math.floor(card.ts / 1000),
    chain: "sol",
    event_type: `agent_${card.kind}`,
    side: card.kind === "drop" ? "sell" : "signal",
    token_address: card.address,
    symbol: card.symbol,
    amount_usd: null,
    wallet: null,
    kol_username: null,
    price_usd: null,
    market_cap: null,
  };
}

function emitAgent() {
  const signals = runAgent(collectTokens(), mem.events);
  if (signals.length) ingest(signals.map(agentEvent));
}

async function pump(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      while (wanted) {
        const job = wanted;
        wanted = null;
        await refreshDesk(job.interval, job.platform, job.feed);
      }
    } finally {
      running = null;
    }
  })();
  await running;
  if (wanted) return pump();
}

function feedPath(feed: DeskFeed) {
  if (feed === "hot_search") return "/v1/market/hot_searches";
  if (isTrenchesFeed(feed)) return "/v1/trenches";
  return "/v1/market/rank";
}

export async function getDeskSnapshot(
  interval: TrendingInterval = "5m",
  platform: TrendingPlatform = "all",
  feed: DeskFeed = "trending",
  pull = false,
): Promise<DeskSnapshot> {
  const key = boardKey(feed, interval, platform);
  const cached = boards.get(key);
  if (cached) showBoard(cached);
  else {
    const any = [...boards.values()].sort((a, b) => b.at - a.at)[0];
    if (any && (!pull || !officialCanCall(feedPath(feed)))) showBoard(any);
  }

  if (!pull) {
    emitAgent();
    return snapshot();
  }

  const now = Date.now();
  const have = boards.get(key);
  const fresh = have && now - have.at < TRENDING_TTL_MS;
  if (!officialCanCall(feedPath(feed))) {
    emitAgent();
    return snapshot();
  }
  if (fresh && !tapeDue(now)) {
    emitAgent();
    return snapshot();
  }

  wanted = { interval, platform, feed };
  await pump();
  emitAgent();
  return snapshot();
}

async function refreshDesk(
  interval: TrendingInterval,
  platform: TrendingPlatform,
  feed: DeskFeed,
): Promise<void> {
  const key = boardKey(feed, interval, platform);
  const cached = boards.get(key);
  if (cached) showBoard(cached);
  try {
    const now = Date.now();
    const boardStale = !cached || now - cached.at >= TRENDING_TTL_MS;
    if (boardStale) {
      await refreshTrending(interval, platform, feed);
    }
    // After board (or if board was fresh), refresh ALL stale tape sources.
    // The old else-if chain updated only ONE per tick → real period up to 6 min.
    if (now - mem.lastSm >= FLOW_TTL_MS) {
      await refreshSmartMoney();
    }
    if (now - mem.lastKol >= FLOW_TTL_MS) {
      await refreshKol();
    }
    if (now - mem.lastSignal >= FLOW_TTL_MS) {
      await refreshSignal();
    }
  } catch (err) {
    mem.lastError = err instanceof Error ? err.message : "GMGN request failed";
  }
}

function extractList(raw: unknown, feed: DeskFeed): Record<string, unknown>[] {
  if (feed === "hot_search") return asHotSearchTokens(raw);
  if (isTrenchesFeed(feed)) {
    const stage = feed === "near_completion" ? "pre_mig" : feed === "completed" ? "migrated" : "fresh";
    return withStage(asTrenchesTokens(raw, TRENCH_BUCKET[feed]), stage);
  }
  return asList(raw);
}

function persistBoard(board: Board) {
  boards.set(board.key, board);
  if (boards.size > BOARD_CAP) {
    const first = boards.keys().next().value;
    if (first) boards.delete(first);
  }
}

async function refreshTrending(interval: TrendingInterval, platform: TrendingPlatform, feed: DeskFeed) {
  const req = buildMarketFeedQuery(feed, interval, platform);
  if (!officialCanCall(req.path)) {
    const st = officialStatus();
    mem.lastError = st.banned
      ? `GMGN banned — cooling ${st.cooldownLeft}s`
      : `GMGN cooling ${st.cooldownLeft}s`;
    return;
  }

  const raw = await gmgn(req.method, req.path, req.weight, req.query, req.body);

  if (isTrenchesFeed(feed)) {
    const stages: Array<[(typeof TRENCH_FEEDS)[number], "fresh" | "pre_mig" | "migrated"]> = [
      ["new_creation", "fresh"],
      ["near_completion", "pre_mig"],
      ["completed", "migrated"],
    ];
    let shown: Board | null = null;
    let total = 0;
    for (const [bucketFeed, stage] of stages) {
      const rows = withStage(asTrenchesTokens(raw, TRENCH_BUCKET[bucketFeed]), stage)
        .map(normalizeTrending)
        .filter((r): r is TrendingRow => r !== null)
        .map((r) => ({ ...r, stage }))
        .filter((r) => platform === "all" || r.launchpad === platform);
      total += rows.length;
      const profiles = await resolveDevProfiles(rows);
      const screened = screenRows(rows, DEFAULT_CONFIG, profiles, CHAIN);
      const byAddr = new Map(screened.candidates.map((c) => [c.features.address, c]));
      const tokens = rows
        .map((row) => toDesk(row, pushSpark(row.address, row.price), byAddr.get(row.address)))
        .sort((a, b) => (a.rank || 999) - (b.rank || 999));
      const board: Board = {
        key: boardKey(bucketFeed, interval, platform),
        feed: bucketFeed,
        interval,
        platform,
        tokens,
        stats: screened.stats,
        at: Date.now(),
      };
      persistBoard(board);
      if (bucketFeed === feed) shown = board;
    }
    saveBoards();
    if (shown) showBoard(shown);
    if (!total && !shown?.tokens.length) throw new Error("Empty trenches universe");
    mem.source = "openapi";
    mem.lastError = null;
    mem.ticks += 1;
    return;
  }

  const rows = extractList(raw, feed)
    .map(normalizeTrending)
    .filter((r): r is TrendingRow => r !== null)
    .filter((r) => platform === "all" || r.launchpad === platform);
  if (!rows.length) throw new Error("Empty trending universe");

  const profiles = await resolveDevProfiles(rows);
  const screened = screenRows(rows, DEFAULT_CONFIG, profiles, CHAIN);
  const byAddr = new Map(screened.candidates.map((c) => [c.features.address, c]));

  const tokens = rows
    .map((row) => {
      const spark = pushSpark(row.address, row.price);
      return toDesk(row, spark, byAddr.get(row.address));
    })
    .sort((a, b) => (a.rank || 999) - (b.rank || 999));

  const board: Board = {
    key: boardKey(feed, interval, platform),
    feed,
    interval,
    platform,
    tokens,
    stats: screened.stats,
    at: Date.now(),
  };
  persistBoard(board);
  saveBoards();
  showBoard(board);
  mem.source = "openapi";
  mem.lastError = null;
  mem.ticks += 1;
}

async function refreshSmartMoney() {
  if (!officialCanCall("/v1/user/smartmoney")) return;
  try {
    const raw = await gmgn("GET", "/v1/user/smartmoney", 1, { chain: CHAIN, limit: 100 });
    ingest(asList(raw).map((i) => normalizeTrack(i, "smart_money")));
    mem.lastSm = Date.now();
    mem.lastOk = mem.lastSm;
    mem.ticks += 1;
  } catch {
    mem.lastSm = Date.now();
  }
}

async function refreshKol() {
  if (!officialCanCall("/v1/user/kol")) return;
  try {
    const raw = await gmgn("GET", "/v1/user/kol", 1, { chain: CHAIN, limit: 100 });
    ingest(asList(raw).map((i) => normalizeTrack(i, "kol")));
    mem.lastKol = Date.now();
    mem.lastOk = mem.lastKol;
    mem.ticks += 1;
  } catch {
    mem.lastKol = Date.now();
  }
}

async function refreshSignal() {
  if (!officialCanCall("/v1/market/token_signal")) return;
  try {
    const raw = await gmgn(
      "POST",
      "/v1/market/token_signal",
      3,
      {},
      { chain: CHAIN, groups: [{ signal_type: [6, 7, 10, 11, 12, 20] }] },
    );
    const items = Array.isArray(raw) ? raw.filter((x) => x && typeof x === "object") : asList(raw);
    ingest((items as Record<string, unknown>[]).map(normalizeSignal));
    mem.lastSignal = Date.now();
    mem.lastOk = mem.lastSignal;
    mem.ticks += 1;
  } catch {
    mem.lastSignal = Date.now();
  }
}

function ingest(events: Array<FlowEvent | null>) {
  const fresh: FlowEvent[] = [];
  for (const e of events) {
    if (!e || !e.key || mem.seen.has(e.key)) continue;
    mem.seen.add(e.key);
    fresh.push(e);
  }
  if (!fresh.length) return;
  mem.events = [...fresh, ...mem.events].slice(0, EVENT_CAP);
  if (mem.seen.size > 12_000) {
    mem.seen = new Set(mem.events.map((e) => e.key));
  }
}

function pushSpark(address: string, price: number): number[] {
  const prev = mem.sparks[address] ?? [];
  const next = [...prev, price].slice(-SPARK);
  if (next.length === 1) next.unshift(price);
  mem.sparks[address] = next;
  return next;
}

function toDesk(
  row: TrendingRow,
  spark: number[],
  cand: ReturnType<typeof screenRows>["candidates"][number] | undefined,
): DeskToken {
  const buys = row.buys;
  const sells = row.sells;
  const token: DeskToken = {
    address: row.address,
    chain: row.chain,
    symbol: row.symbol,
    name: row.name,
    logo: row.logo,
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
    twitter: row.twitter,
    website: row.website,
    telegram: row.telegram,
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
}

const walletCache = new Map<string, CacheEntry<WalletDossier>>();
const devCache = new Map<string, CacheEntry<DevProfile | null>>();

async function resolveDevProfiles(
  rows: TrendingRow[],
): Promise<Record<string, DevProfile | null | undefined>> {
  const now = Date.now() / 1000;
  const prelim: Array<{ address: string; creator: string; score: number }> = [];
  for (const row of rows) {
    if (!row.address || !row.creator) continue;
    const f = buildFromRow(row, now);
    if (!hardGates(f, DEFAULT_CONFIG).passed) continue;
    prelim.push({
      address: row.address,
      creator: row.creator,
      score: scoreComponents(f, DEFAULT_CONFIG).score,
    });
  }
  prelim.sort((a, b) => b.score - a.score);
  const pool = prelim.slice(0, DEFAULT_CONFIG.dev_pool_n);

  const profiles: Record<string, DevProfile | null | undefined> = {};
  for (const { address } of pool) {
    const row = rows.find((r) => r.address === address);
    profiles[address] = overlayRowDev(null, row);
  }
  return profiles;
}

function overlayRowDev(profile: DevProfile | null, row: TrendingRow | undefined): DevProfile | null {
  if (!row?.creator_close && !row?.cto_flag) return profile;
  const next = profile ?? emptyDev(row.creator);
  if (row.creator_close) next.exited = true;
  if (row.cto_flag) next.cto = true;
  return next;
}

async function getDevProfile(creator: string): Promise<DevProfile | null> {
  const hit = devCache.get(creator);
  if (hit && Date.now() - hit.at < DEV_TTL_MS) return hit.value;
  if (!officialCanCall("/v1/user/created_tokens")) return null;

  const created = await gmgn("GET", "/v1/user/created_tokens", 2, {
    chain: CHAIN,
    wallet_address: creator,
    order_by: "token_ath_mc",
  }).catch(() => null);
  if (!created) {
    devCache.set(creator, { at: Date.now(), value: null });
    return null;
  }

  const createdObj = unwrap(created);
  const c =
    createdObj && typeof createdObj === "object" && !Array.isArray(createdObj)
      ? (createdObj as Record<string, unknown>)
      : {};
  const tokens = asList(created);
  const inner_count = int(c.inner_count);
  const open_count = int(c.open_count);

  if (tokens.length === 0 && inner_count + open_count === 0) {
    devCache.set(creator, { at: Date.now(), value: null });
    return null;
  }

  const recent = [...tokens]
    .sort((a, b) => num(b.create_timestamp) - num(a.create_timestamp))
    .slice(0, DEV_SEC_SCAN_N);

  const secScans: Array<Record<string, unknown>> = [];
  for (const t of recent) {
    const addr = str(t.token_address || t.address);
    if (!addr) continue;
    if (!officialCanCall("/v1/token/security")) break;
    const sec = await gmgn("GET", "/v1/token/security", 1, {
      chain: CHAIN,
      address: addr,
    }).catch(() => null);
    if (sec == null) continue;
    const s = unwrap(sec);
    if (s && typeof s === "object" && !Array.isArray(s)) {
      secScans.push(s as Record<string, unknown>);
    }
  }

  const profile = buildDevProfile(creator, c, tokens, secScans);
  devCache.set(creator, { at: Date.now(), value: profile });
  return profile;
}

function buildDevProfile(
  creator: string,
  c: Record<string, unknown>,
  tokens: Record<string, unknown>[],
  secScans: Record<string, unknown>[],
): DevProfile {
  const open_count = int(c.open_count);
  const inner_count = int(c.inner_count);
  const openRatio = numOpt(c.open_ratio);
  const ath = num((c.creator_ath_info as Record<string, unknown> | undefined)?.ath_mc);

  let analyzed = 0;
  let alive = 0;
  for (const t of tokens) {
    analyzed += 1;
    if (bool(t.is_open) && num(t.pool_liquidity) >= 4000) alive += 1;
  }
  const rugged = Math.max(0, analyzed - alive);
  const rug_rate = analyzed > 0 ? rugged / analyzed : 0;
  const survival_rate =
    openRatio != null
      ? openRatio
      : open_count + inner_count > 0
        ? open_count / (open_count + inner_count)
        : 0;

  const sec_risks: string[] = [];
  let sec_unsafe = 0;
  const sec_checked = secScans.length;
  for (const s of secScans) {
    const unsafe: string[] = [];
    if (s.renounced_mint != null && !bool(s.renounced_mint)) unsafe.push("mintable");
    if (s.renounced_freeze_account != null && !bool(s.renounced_freeze_account)) {
      unsafe.push("freeze");
    }
    if (bool(s.is_honeypot)) unsafe.push("honeypot");
    if (unsafe.length) {
      sec_unsafe += 1;
      sec_risks.push(unsafe.join("+"));
    }
  }
  const sec_risk_rate = sec_checked > 0 ? sec_unsafe / sec_checked : 0;

  return {
    creator,
    analyzed,
    alive,
    rugged,
    rug_rate,
    launches: open_count,
    inner_count,
    survival_rate,
    ath_mc: ath,
    exited: false,
    own_img_reuse: 0,
    cto: false,
    sec_risk_rate,
    sec_unsafe,
    sec_risks,
    sec_checked,
  };
}

export async function getWalletDossier(address: string): Promise<WalletDossier> {
  const hit = walletCache.get(address);
  if (hit && Date.now() - hit.at < WALLET_TTL_MS) return hit.value;

  const stats = officialCanCall("/v1/user/wallet_stats")
    ? await gmgn("GET", "/v1/user/wallet_stats", 3, {
        chain: CHAIN,
        wallet_address: [address],
        period: "7d",
      }).catch(() => null)
    : null;
  const created = officialCanCall("/v1/user/created_tokens")
    ? await gmgn("GET", "/v1/user/created_tokens", 2, {
        chain: CHAIN,
        wallet_address: address,
        order_by: "token_ath_mc",
      }).catch(() => null)
    : null;
  const activity = officialCanCall("/v1/user/wallet_activity")
    ? await gmgn("GET", "/v1/user/wallet_activity", 3, {
        chain: CHAIN,
        wallet_address: address,
        limit: 30,
      }).catch(() => null)
    : null;

  const dossier = parseWallet(address, stats, created, activity);
  walletCache.set(address, { at: Date.now(), value: dossier });
  return dossier;
}
