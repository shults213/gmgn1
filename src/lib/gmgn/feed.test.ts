import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMarketFeedQuery } from "./query.ts";

describe("buildMarketFeedQuery", () => {
  it("Trend hits rank with platforms[], not platform", () => {
    const req = buildMarketFeedQuery("trending", "5m", "Pump.fun");
    assert.equal(req.method, "GET");
    assert.equal(req.path, "/v1/market/rank");
    assert.deepEqual(req.query.platforms, ["Pump.fun"]);
    assert.equal(req.query.platform, undefined);
    assert.equal(req.query.order_by, "volume");
    assert.equal(req.query.interval, "5m");
  });

  it("New hits POST /v1/trenches new_creation, not rank", () => {
    const req = buildMarketFeedQuery("new_creation", "5m", "letsbonk");
    assert.equal(req.method, "POST");
    assert.equal(req.path, "/v1/trenches");
    assert.equal(req.query.chain, "sol");
    assert.ok(req.body && "new_creation" in req.body);
    assert.equal(req.body?.version, "v2");
    const section = req.body?.new_creation as Record<string, unknown>;
    assert.deepEqual(section.launchpad_platform, ["letsbonk"]);
    assert.equal(section.launchpad_platform_v2, true);
    assert.ok(req.body && "pump" in req.body === false);
    assert.ok(req.body && "near_completion" in req.body);
    assert.ok(req.body && "completed" in req.body);
  });

  it("Pre and Post share the same trenches call", () => {
    const pre = buildMarketFeedQuery("near_completion", "5m", "all");
    const post = buildMarketFeedQuery("completed", "5m", "all");
    assert.equal(pre.path, "/v1/trenches");
    assert.equal(post.path, "/v1/trenches");
    assert.equal(pre.weight, 3);
    assert.ok(pre.body && "near_completion" in pre.body && "completed" in pre.body && "new_creation" in pre.body);
  });

  it("Hot search sends labeled params body", () => {
    const req = buildMarketFeedQuery("hot_search", "1h", "all");
    assert.equal(req.method, "POST");
    assert.equal(req.path, "/v1/market/hot_searches");
    const params = (req.body as { params: Array<Record<string, unknown>> }).params;
    assert.equal(params.length, 1);
    assert.equal(params[0].label, "hot-search");
    assert.equal(params[0].chain, "sol");
    assert.equal(params[0].interval, "1h");
    assert.equal(params[0].limit, 100);
  });
});
