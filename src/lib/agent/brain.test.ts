import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyMemory, scoreTick, stepAgent } from "./brain.ts";
import type { AgentTick } from "./types.ts";

function tick(over: Partial<AgentTick> = {}): AgentTick {
  return {
    address: "tok1",
    symbol: "SOON",
    name: "Soon",
    stage: "pre_mig",
    progress: 0.82,
    marketCap: 40_000,
    buyRatio: 0.62,
    ch5m: 12,
    smartDegen: 3,
    renowned: 1,
    rugRatio: 0.1,
    bundler: 0.05,
    creatorClose: false,
    honeypot: false,
    status: "pending",
    reasonCode: null,
    completeAt: 0,
    ts: Date.now(),
    ...over,
  };
}

describe("scoreTick", () => {
  it("alerts a filling pre-migration with SM", () => {
    const hit = scoreTick(tick(), undefined, true, { curve: 1, sm: 1, migrate: 1 }, Date.now());
    assert.ok(hit);
    assert.equal(hit.kind, "alert");
    assert.ok(hit.score >= 62);
  });

  it("ignores honeypots", () => {
    assert.equal(scoreTick(tick({ honeypot: true }), undefined, false, { curve: 1, sm: 1, migrate: 1 }, Date.now()), null);
  });

  it("drops sell pressure", () => {
    const hit = scoreTick(tick({ buyRatio: 0.3, progress: 0.6 }), undefined, false, { curve: 1, sm: 1, migrate: 1 }, Date.now());
    assert.ok(hit);
    assert.equal(hit.kind, "drop");
  });
});

describe("stepAgent", () => {
  it("keeps three focus slots and emits a cooled signal once", () => {
    const mem = emptyMemory();
    const now = Date.now();
    const ticks = [
      tick({ address: "a", symbol: "A" }),
      tick({ address: "b", symbol: "B", progress: 0.7 }),
      tick({ address: "c", symbol: "C", progress: 0.66, smartDegen: 1 }),
      tick({ address: "d", symbol: "D", progress: 0.6, smartDegen: 0, buyRatio: 0.51 }),
    ];
    const first = stepAgent(ticks, new Set(["a"]), mem, now);
    assert.ok(first.focus.length <= 3);
    assert.ok(first.signals.length >= 1);
    const again = stepAgent(ticks, new Set(["a"]), first.mem, now + 1_000);
    assert.equal(again.signals.length, 0);
    assert.equal(again.focus[0]?.address, first.focus[0]?.address);
  });
});
