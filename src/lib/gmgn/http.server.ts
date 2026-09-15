/**
 * GMGN OpenAPI — Free plan weighted token bucket.
 *
 * Brochure: calls/sec = PLAN_WEIGHT / API_WEIGHT (Free = 5 weight/sec).
 * In practice GMGN IP-bans bursts, so the default budget is conservative:
 * GMGN_RATE_WPS=2.5 (half the plan). Raise gradually towards 5 with
 * GMGN_DEBUG=1 metrics watching for 429s.
 *
 * Config (env):
 *   GMGN_RATE_WPS        — weight-units spent per second (default 2.5, max sane 5)
 *   GMGN_RATE_BURST      — bucket capacity in weight (default = 1s of budget)
 *   GMGN_MAX_CONCURRENT  — simultaneous in-flight HTTP calls (default 2)
 *   GMGN_DEBUG=1         — per-request perf + cache/dedup logs (never logs keys)
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const HOST = "https://openapi.gmgn.ai";
export const PLAN_WEIGHT = 5;

export const WEIGHT: Record<string, number> = {
  "/v1/token/info": 1,
  "/v1/token/security": 1,
  "/v1/token/pool_info": 1,
  "/v1/market/token_top_holders": 5,
  "/v1/market/token_top_traders": 5,
  "/v1/user/kol": 1,
  "/v1/user/smartmoney": 1,
  "/v1/trade/follow_wallet": 3,
  "/v1/user/follow_tokens": 3,
  "/v1/user/follow_token_groups": 1,
  "/v1/market/rank": 1,
  "/v1/market/token_kline": 2,
  "/v1/market/hot_searches": 3,
  "/v1/market/token_signal": 3,
  "/v1/trenches": 3,
  "/v1/user/info": 1,
  "/v1/user/wallet_stats": 3,
  "/v1/user/wallet_activity": 3,
  "/v1/user/created_tokens": 2,
};

const BACKOFF_MS = 3_000;
const BAN_PAD_MS = 20_000;
const COOL_FILE = join(tmpdir(), "gmgn-desk-cool.json");

const DEBUG = typeof process !== "undefined" && process.env.GMGN_DEBUG === "1";

function envNumber(key: string, fallback: number, min: number, max: number): number {
  const raw = typeof process !== "undefined" ? Number(process.env[key]) : NaN;
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

/**
 * Weight budget per second. Official Free plan = PLAN_WEIGHT (5). Default is
 * half of it — GMGN IP-bans aggressive callers even inside plan limits.
 * Tune upward with GMGN_RATE_WPS (watch [GMGN] logs + 429s), never above 5.
 */
export function rateConfig() {
  const perSec = envNumber("GMGN_RATE_WPS", 2.5, 0.4, PLAN_WEIGHT);
  const burst = envNumber("GMGN_RATE_BURST", perSec, 1, PLAN_WEIGHT * 2);
  const concurrent = Math.round(envNumber("GMGN_MAX_CONCURRENT", 2, 1, 4));
  return { perSec, burst, concurrent };
}

/** Rolling request counters — cheap in-process benchmark, no key material. */
const bench = {
  requests: 0,
  cacheHits: 0,
  dedupHits: 0,
  code429: 0,
  totalQueueMs: 0,
  totalNetMs: 0,
};
export function benchStats() {
  return { ...bench };
}

export class OpenApiError extends Error {
  status: number;
  resetAt: number;
  banned: boolean;
  constructor(msg: string, status = 0, resetAt = 0, banned = false) {
    super(msg);
    this.name = "OpenApiError";
    this.status = status;
    this.resetAt = resetAt;
    this.banned = banned;
  }
}

function apiKey(): string {
  const env = typeof process !== "undefined" ? process.env : undefined;
  const fromEnv = env?.["GMGN_API_KEY"];
  if (fromEnv && fromEnv.length > 10) return fromEnv;
  return "gmgn_47f23fd2a6b52e9655b7ba0573f4a617";
}

export function hasKey(): boolean {
  return apiKey().length > 10;
}

export function weightFor(path: string): number {
  return WEIGHT[path] ?? 1;
}

type CoolFile = { bannedUntil: number; routes: Record<string, number> };

function loadCool(): CoolFile {
  try {
    const j = JSON.parse(readFileSync(COOL_FILE, "utf8")) as CoolFile;
    return {
      bannedUntil: Number(j.bannedUntil) || 0,
      routes: j.routes && typeof j.routes === "object" ? j.routes : {},
    };
  } catch {
    return { bannedUntil: 0, routes: {} };
  }
}

function saveCool() {
  try {
    const routes: Record<string, number> = {};
    for (const [k, v] of resetAt) {
      if (v > Date.now()) routes[k] = v;
    }
    writeFileSync(
      COOL_FILE,
      JSON.stringify({ bannedUntil: bannedUntil > Date.now() ? bannedUntil : 0, routes }),
    );
  } catch {
    /* tmpfs may be missing in tests */
  }
}

const persisted = loadCool();
const resetAt = new Map<string, number>(Object.entries(persisted.routes));
let bannedUntil = persisted.bannedUntil || 0;

/**
 * Weighted token bucket with bounded concurrency.
 *
 * - Budget is in GMGN weight units: `perSec` refills the bucket, a call of
 *   weight W spends W tokens. Calls never start until they can pay in full.
 * - Up to `concurrent` requests may be in flight at once — the 45s desk cycle
 *   (rank w1 + tape w1/w1/w3 ≈ 6 weight) completes in ~2.5s at the default
 *   2.5 w/s budget instead of ~15s with the old serial gap pacing.
 * - Cooldown paths (429/ban) are enforced by callers BEFORE acquire, so a
 *   blocked route never parks a queue slot.
 */
export class WeightedLimiter {
  private tokens: number;
  private lastFill: number;
  private inFlight = 0;
  private queue: Array<{ weight: number; go: () => void }> = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly perSec: number;
  private readonly capacity: number;
  private readonly maxConcurrent: number;

  constructor(perSec: number, capacity: number, maxConcurrent: number) {
    this.perSec = perSec;
    this.capacity = capacity;
    this.maxConcurrent = maxConcurrent;
    this.tokens = capacity;
    this.lastFill = Date.now();
  }

  /** Current rotating config (env is read fresh so tests can override). */
  static fromEnv(): WeightedLimiter {
    const { perSec, burst, concurrent } = rateConfig();
    return new WeightedLimiter(perSec, burst, concurrent);
  }

  acquire(weight: number): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ weight, go: resolve });
      this.pump();
    });
  }

  release() {
    this.inFlight -= 1;
    this.pump();
  }

  private refill() {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.lastFill) / 1000) * this.perSec);
    this.lastFill = now;
  }

  private pump() {
    this.refill();
    while (this.inFlight < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue[0];
      if (this.tokens < next.weight) break;
      this.queue.shift();
      this.tokens -= next.weight;
      this.inFlight += 1;
      next.go();
    }
    if (this.queue.length > 0 && !this.timer) {
      // Next affordable moment or sooner if a release() beats the timer.
      const deficit = this.queue[0].weight - this.tokens;
      const waitMs = Math.max(5, (Math.max(0, deficit) / this.perSec) * 1000);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pump();
      }, Math.min(waitMs, 5_000));
      this.timer.unref?.();
    }
  }

  /** Drain bucket to zero — called on 429 so subsequent calls back off. */
  drain() {
    this.tokens = 0;
    this.lastFill = Date.now();
  }
}

const limiter = WeightedLimiter.fromEnv();

export type RateLimitInfo = {
  untilMs: number;
  banned: boolean;
  message: string;
};

export function parseRateLimit(
  status: number,
  headers: { get(name: string): string | null },
  json: unknown,
  text = "",
): RateLimitInfo | null {
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const msg = String(body.message || body.msg || body.error || text).slice(0, 240);
  const error = String(body.error || "");
  const hit =
    status === 429 ||
    error === "RATE_LIMIT_BANNED" ||
    /rate.?limit|banned/i.test(msg) ||
    /rate.?limit|banned/i.test(error);
  if (!hit) return null;

  const headerReset = Number(headers.get("x-ratelimit-reset") || 0);
  const retryAfter = Number(headers.get("retry-after") || 0);
  const bodyReset = Number(body.reset_at || body.reset || 0);
  const resetUnix = headerReset > 1_000_000_000 ? headerReset : bodyReset > 1_000_000_000 ? bodyReset : 0;
  const banned = error === "RATE_LIMIT_BANNED" || /temporarily banned|RATE_LIMIT_BANNED/i.test(msg);
  const untilMs = resetUnix
    ? resetUnix * 1000
    : retryAfter > 0
      ? Date.now() + retryAfter * 1000
      : Date.now() + (banned ? 120_000 : BACKOFF_MS);
  return { untilMs, banned, message: msg || "GMGN rate limited" };
}

function markLimit(path: string, info: RateLimitInfo) {
  const until = info.untilMs + (info.banned ? BAN_PAD_MS : 0);
  if (info.banned) {
    bannedUntil = Math.max(bannedUntil, until);
    for (const route of Object.keys(WEIGHT)) {
      resetAt.set(route, bannedUntil);
    }
    resetAt.set("*", bannedUntil);
  } else {
    resetAt.set(path, Math.max(resetAt.get(path) ?? 0, until));
  }
  saveCool();
}

/** In-flight deduplication: identical in-flight requests share one Promise. */
const inflight = new Map<string, Promise<unknown>>();

function dedupKey(method: string, path: string, query: Record<string, unknown>, body: unknown): string {
  const q = JSON.stringify(query);
  const b = body === null ? "" : JSON.stringify(body);
  return `${method}:${path}?${q}#${b}`;
}

export function officialStatus() {
  const now = Date.now();
  const cooling: Record<string, number> = {};
  for (const [path, until] of resetAt) {
    if (until > now) cooling[path] = Math.ceil((until - now) / 1000);
  }
  if (bannedUntil > now) cooling["*"] = Math.ceil((bannedUntil - now) / 1000);
  return {
    hasKey: hasKey(),
    banned: bannedUntil > now,
    cooling: Object.keys(cooling).length > 0,
    cooldownLeft: Math.max(0, ...Object.values(cooling), 0),
    coolingRoutes: cooling,
    planWeight: PLAN_WEIGHT,
  };
}

export function officialCanCall(path: string): boolean {
  if (!hasKey()) return false;
  const now = Date.now();
  if (now < bannedUntil) return false;
  const until = Math.max(resetAt.get(path) ?? 0, resetAt.get("*") ?? 0);
  return now >= until;
}

function envelopeData(doc: unknown): unknown {
  if (!doc || typeof doc !== "object") return doc;
  const root = doc as Record<string, unknown>;
  if (root.code !== undefined && root.code !== null && root.code !== 0 && root.code !== 200) {
    const msg = String(root.message || root.msg || `GMGN code ${root.code}`);
    throw new OpenApiError(msg, Number(root.code) || 0);
  }
  let data: unknown = "data" in root ? root.data : doc;
  const env = new Set(["code", "data", "message", "msg", "reason"]);
  while (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "data" in (data as object) &&
    Object.keys(data as object).every((k) => env.has(k))
  ) {
    const inner = data as Record<string, unknown>;
    if (inner.code !== undefined && inner.code !== null && inner.code !== 0 && inner.code !== 200) {
      throw new OpenApiError(String(inner.message || inner.msg || `GMGN code ${inner.code}`));
    }
    data = inner.data;
  }
  return data;
}

export async function officialRequest(
  method: "GET" | "POST",
  path: string,
  weight: number,
  query: Record<string, string | number | string[] | undefined> = {},
  body: unknown = null,
): Promise<unknown> {
  const w = weight || weightFor(path);
  const key = dedupKey(method, path, query as Record<string, unknown>, body);

  // In-flight deduplication
  const existing = inflight.get(key);
  if (existing) {
    bench.dedupHits += 1;
    if (DEBUG) console.log(`[DEDUP] ${path} w=${w}`);
    return existing;
  }

  if (!officialCanCall(path)) {
    const st = officialStatus();
    throw new OpenApiError(
      st.banned
        ? `GMGN banned — cooling ${st.cooldownLeft}s (not retrying)`
        : `GMGN cooling ${st.cooldownLeft}s`,
      429,
      Math.ceil((bannedUntil || Date.now()) / 1000),
      st.banned,
    );
  }

  const p = (async () => {
    const t0 = Date.now();
    await limiter.acquire(w);
    const tQueue = Date.now();

    const url = new URL(path, HOST);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === "") continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    url.searchParams.set("timestamp", String(Math.floor(Date.now() / 1000)));
    url.searchParams.set("client_id", randomUUID());

    const headers: Record<string, string> = {
      "X-APIKEY": apiKey(),
      accept: "application/json",
      "User-Agent": "gmgn-desk/1.0",
    };
    if (body !== null) headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
    });

    const tNet = Date.now();
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const limit = parseRateLimit(res.status, res.headers, json, text);
    if (limit) {
      bench.code429 += 1;
      // Penalty: drain bucket so subsequent calls back off immediately
      limiter.release(); // release the slot first
      limiter.drain?.(); // drain tokens to 0
      markLimit(path, limit);
      throw new OpenApiError(limit.message, 429, Math.floor(limit.untilMs / 1000), limit.banned);
    }

    if (!res.ok) {
      const msg =
        (json && typeof json === "object" && "message" in json
          ? String((json as { message: unknown }).message)
          : text.slice(0, 180)) || `GMGN ${res.status}`;
      throw new OpenApiError(msg, res.status);
    }

    if (DEBUG) {
      const total = Date.now() - t0;
      const queue = tQueue - t0;
      const net = tNet - tQueue;
      bench.requests += 1;
      bench.totalQueueMs += queue;
      bench.totalNetMs += net;
      console.log(`[GMGN] ${path} w=${w} queue=${queue}ms net=${net}ms total=${total}ms status=${res.status}`);
    }

    return envelopeData(json);
  })().finally(() => {
    inflight.delete(key);
    limiter.release();
  });

  inflight.set(key, p);
  return p;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
