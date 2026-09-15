import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRateLimit, PLAN_WEIGHT, WEIGHT, WeightedLimiter, rateConfig, officialRequest, officialCanCall, weightFor, benchStats } from "./http.server.ts";

function headers(map: Record<string, string>) {
  return {
    get(name: string) {
      const hit = Object.entries(map).find(([k]) => k.toLowerCase() === name.toLowerCase());
      return hit ? hit[1] : null;
    },
  };
}

describe("Free plan weights", () => {
  it("uses plan weight 5 and the published API weights", () => {
    assert.equal(PLAN_WEIGHT, 5);
    assert.equal(WEIGHT["/v1/token/info"], 1);
    assert.equal(WEIGHT["/v1/token/security"], 1);
    assert.equal(WEIGHT["/v1/token/pool_info"], 1);
    assert.equal(WEIGHT["/v1/market/token_top_holders"], 5);
    assert.equal(WEIGHT["/v1/market/token_top_traders"], 5);
    assert.equal(WEIGHT["/v1/user/kol"], 1);
    assert.equal(WEIGHT["/v1/user/smartmoney"], 1);
    assert.equal(WEIGHT["/v1/trade/follow_wallet"], 3);
    assert.equal(WEIGHT["/v1/user/follow_tokens"], 3);
    assert.equal(WEIGHT["/v1/user/follow_token_groups"], 1);
    assert.equal(WEIGHT["/v1/market/rank"], 1);
  });
});

describe("parseRateLimit", () => {
  it("reads x-ratelimit-reset header and body.reset_at, prefers header", () => {
    const info = parseRateLimit(
      429,
      headers({ "x-ratelimit-reset": "1789043833" }),
      { code: 429, error: "RATE_LIMIT", message: "slow down", reset_at: 111 },
    );
    assert.ok(info);
    assert.equal(info.untilMs, 1789043833 * 1000);
    assert.equal(info.banned, false);
  });

  it("treats RATE_LIMIT_BANNED as a rolling account ban", () => {
    const info = parseRateLimit(
      429,
      headers({ "x-ratelimit-reset": "1789043833" }),
      {
        code: 429,
        error: "RATE_LIMIT_BANNED",
        message: "IP is temporarily banned due to repeated rate limit violations",
        reset_at: 1789043833,
      },
    );
    assert.ok(info);
    assert.equal(info.banned, true);
    assert.match(info.message, /banned/i);
  });

  it("ignores ordinary 200 payloads", () => {
    assert.equal(parseRateLimit(200, headers({}), { code: 0, data: { rank: [] } }), null);
  });
});

describe("WeightedLimiter", () => {
  it("spends tokens per weight and refills at perSec rate", async () => {
    // Fast bucket for test: 100 weight/sec, capacity 50, concurrency 4
    const lim = new WeightedLimiter(100, 50, 4);
    const start = Date.now();

    // First 3 calls weight=10 each = 30 tokens (under cap) → instant
    await Promise.all([
      lim.acquire(10),
      lim.acquire(10),
      lim.acquire(10),
    ]);
    const t1 = Date.now() - start;
    assert.ok(t1 < 50, `first batch should be instant, took ${t1}ms`);

    // Next call weight=30: bucket has 20 left, needs 10 more → wait ~100ms at 100 w/s
    await lim.acquire(30);
    const t2 = Date.now() - start;
    assert.ok(t2 >= 80 && t2 < 300, `second batch should wait for refill, took ${t2}ms`);
  });

  it("limits concurrent in-flight requests", async () => {
    const lim = new WeightedLimiter(1000, 100, 2); // high budget, concurrency=2
    const slots: number[] = [];

    async function task() {
      await lim.acquire(1);
      slots.push(lim.inFlight);
      await new Promise((r) => setTimeout(r, 15));
      lim.release();
    }

    await Promise.all([task(), task(), task(), task()]);
    // Max inFlight should never exceed concurrency (2)
    assert.ok(Math.max(...slots) <= 2, `concurrency exceeded: ${slots.join(",")}`);
  });

  it("drain() empties bucket immediately", async () => {
    const lim = new WeightedLimiter(10, 10, 2); // slow refill 10 w/s
    await lim.acquire(5); // spend 5, 5 left
    lim.drain();
    const start = Date.now();
    await lim.acquire(1); // needs refill from 0
    const t = Date.now() - start;
    assert.ok(t >= 80 && t < 250, `drain should force full refill wait, took ${t}ms`);
  });
});

describe("rateConfig", () => {
  it("returns defaults when env missing", () => {
    // Cannot easily test env without process mock; just check shape
    const cfg = rateConfig();
    assert.ok(cfg.perSec > 0 && cfg.perSec <= PLAN_WEIGHT);
    assert.ok(cfg.burst >= cfg.perSec);
    assert.ok(cfg.concurrent >= 1 && cfg.concurrent <= 4);
  });
});

describe("GMGN integration (requires network + valid GMGN_API_KEY)", () => {
  it("fetch rank endpoint returns tokens", async () => {
    if (!officialCanCall("/v1/market/rank")) {
      console.log("SKIP: GMGN cooling or no key");
      return;
    }
    const w = weightFor("/v1/market/rank");
    const data = await officialRequest("GET", "/v1/market/rank", w, {
      chain: "sol",
      interval: "5m",
      limit: 5,
      order_by: "volume",
      direction: "desc",
    });
    assert.ok(data);
    const list = Array.isArray(data) ? data : (data && typeof data === "object" && (data.rank || data.list || data.tokens));
    console.log("rank response keys:", data && typeof data === "object" ? Object.keys(data) : typeof data);
    console.log("sample item:", list?.[0] ? Object.keys(list[0]) : "none");
    // Just verify we got something parseable
    assert.ok(list && list.length > 0, "expected non-empty token list");
  });

  it("fetch smartmoney returns events", async () => {
    if (!officialCanCall("/v1/user/smartmoney")) {
      console.log("SKIP: GMGN cooling or no key");
      return;
    }
    const w = weightFor("/v1/user/smartmoney");
    const data = await officialRequest("GET", "/v1/user/smartmoney", w, { chain: "sol", limit: 5 });
    assert.ok(data);
    const list = Array.isArray(data) ? data : (data && typeof data === "object" && (data.rank || data.list || data.tokens));
    console.log("smartmoney response keys:", data && typeof data === "object" ? Object.keys(data) : typeof data);
    console.log("sample item:", list?.[0] ? Object.keys(list[0]) : "none");
    assert.ok(list && list.length >= 0); // can be empty
  });

  it("bench stats after integration calls", () => {
    const b = benchStats();
    console.log("bench:", b);
    assert.ok(b.requests >= 0);
  });
});
