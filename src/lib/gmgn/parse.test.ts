import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  asHotSearchTokens,
  asList,
  asTrenchesTokens,
  bool,
  normalizeTrending,
  num,
  parseWallet,
  unwrap,
} from "./parse.ts";

const liveRankToken = {
  chain: "sol",
  address: "5Uh8h8fEGYCK6zifyWEWkrzBTcigWLebUnfU5Wvg6h3J",
  name: "The Holy Manatee",
  symbol: "MANATEE",
  logo: "https://gmgn.ai/external-res/a06a610296582bea94af2a5761681f5a_v2.webp",
  price: 0.000177672,
  price_change_percent: 103.365,
  price_change_percent1m: 11.014,
  price_change_percent5m: 103.365,
  price_change_percent1h: 1357.46,
  volume: 132218,
  liquidity: 35017.3,
  market_cap: 173013,
  swaps: 2085,
  buys: 1101,
  sells: 984,
  holder_count: 617,
  top_10_holder_rate: 0.2464,
  open_timestamp: 1789036612,
  creation_timestamp: 1789036612,
  launchpad: "pump",
  launchpad_platform: "Pump.fun",
  twitter_username: "https://x.com/i/communities/2029355228609601556",
  website: "https://x.com/EvolveWildlife/status/2097333486659260893/quotes",
  telegram: "",
  renounced_mint: 1,
  renounced_freeze_account: 1,
  creator: "H6hPTUg73GDscH4Q9NAviJrUtMwUXE6PzZat2xWDszrJ",
  creator_token_status: "creator_close",
  creator_close: true,
  is_wash_trading: false,
  cto_flag: 1,
  rug_ratio: 0.21,
  sniper_count: 15,
  smart_degen_count: 24,
  renowned_count: 5,
  bundler_rate: 0.375,
  dev_team_hold_rate: 0,
  buy_tax: "",
  sell_tax: "",
  is_honeypot: 0,
};

describe("unwrap / asList", () => {
  it("unwraps the double {code,data:{code,data:{rank}}} envelope", () => {
    const payload = {
      code: 0,
      data: { code: 0, data: { rank: [liveRankToken] }, message: "success", reason: "" },
    };
    const inner = unwrap(payload);
    assert.deepEqual(Object.keys(inner as object), ["rank"]);
    assert.equal(asList(payload).length, 1);
    assert.equal(asList(payload)[0].symbol, "MANATEE");
  });

  it("reads hot-search blocks of tokens", () => {
    const payload = {
      code: 0,
      data: [{ interval: "5m", chain: "sol", tokens: [liveRankToken] }],
    };
    const tokens = asHotSearchTokens(payload);
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].address, liveRankToken.address);
  });

  it("reads trenches new_creation without mixing pump/completed", () => {
    const payload = {
      code: 0,
      data: {
        new_creation: [{ address: "new1", usd_market_cap: 12000, created_timestamp: 10 }],
        pump: [{ address: "pump1" }],
        completed: [{ address: "done1" }],
      },
    };
    const fresh = asTrenchesTokens(payload, "new_creation");
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0].address, "new1");
    assert.equal(asTrenchesTokens(payload, "pump")[0].address, "pump1");
    assert.equal(asTrenchesTokens(payload, "completed")[0].address, "done1");
  });
});

describe("normalizeTrending", () => {
  it("maps a live rank row without dropping metrics", () => {
    const row = normalizeTrending(liveRankToken);
    assert.ok(row);
    assert.equal(row.address, liveRankToken.address);
    assert.equal(row.symbol, "MANATEE");
    assert.equal(row.market_cap, 173013);
    assert.equal(row.volume, 132218);
    assert.equal(row.liquidity, 35017.3);
    assert.equal(row.price_change_percent5m, 103.365);
    assert.equal(row.price_change_percent1h, 1357.46);
    assert.equal(row.buys, 1101);
    assert.equal(row.sells, 984);
    assert.equal(row.holder_count, 617);
    assert.equal(row.rug_ratio, 0.21);
    assert.equal(row.bundler_rate, 0.375);
    assert.equal(row.smart_degen_count, 24);
    assert.equal(row.renowned_count, 5);
    assert.equal(row.sniper_count, 15);
    assert.equal(row.launchpad, "Pump.fun");
    assert.equal(row.creator, liveRankToken.creator);
    assert.equal(row.renounced_mint, true);
    assert.equal(row.renounced_freeze_account, true);
    assert.equal(row.is_honeypot, false);
    assert.equal(row.buy_tax, 0);
    assert.equal(row.sell_tax, 0);
    assert.equal(row.creator_close, true);
    assert.equal(row.cto_flag, true);
    assert.equal(row.twitter, liveRankToken.twitter_username);
  });

  it("reads bonding progress as 0-1 and tags pre-migration", () => {
    const row = normalizeTrending({
      address: "Curve111",
      symbol: "SOON",
      progress: 82,
      launchpad_platform: "Pump.fun",
    });
    assert.ok(row);
    assert.equal(row.progress, 0.82);
    assert.equal(row.stage, "pre_mig");
  });

  it("tags completed tokens as migrated", () => {
    const row = normalizeTrending({
      address: "Done111",
      symbol: "GRAD",
      complete_timestamp: 1789000000,
      exchange: "pump_amm",
    });
    assert.ok(row);
    assert.equal(row.complete, true);
    assert.equal(row.stage, "migrated");
    assert.equal(row.exchange, "pump_amm");
  });

  it("accepts trenches aliases usd_market_cap / created_timestamp / token_address", () => {
    const row = normalizeTrending({
      token_address: "Token111",
      symbol: "NEW",
      usd_market_cap: "8800",
      pool_liquidity: "4100",
      volume_1h: "2500",
      created_timestamp: 1789000000,
      launchpad: "pump",
      creator_token_status: "creator_hold",
      cto_flag: "0",
    });
    assert.ok(row);
    assert.equal(row.address, "Token111");
    assert.equal(row.market_cap, 8800);
    assert.equal(row.liquidity, 4100);
    assert.equal(row.volume, 2500);
    assert.equal(row.creation_timestamp, 1789000000);
    assert.equal(row.creator_close, false);
    assert.equal(row.cto_flag, false);
  });
});

describe("bool / num empty tax", () => {
  it("treats empty tax strings as 0, not NaN", () => {
    assert.equal(num(""), 0);
    assert.equal(num("0.1"), 0.1);
  });
  it("treats 1 / 0 / empty honeypot correctly", () => {
    assert.equal(bool(1), true);
    assert.equal(bool(0), false);
    assert.equal(bool(""), false);
    assert.equal(bool("yes"), true);
  });
});

describe("parseWallet", () => {
  it("prefers buy_count over buy and cost_usd over token_amount", () => {
    const dossier = parseWallet(
      "Wallet111",
      {
        data: {
          realized_profit: 1200,
          unrealized_profit: -80,
          winrate: 0.62,
          buy_count: 14,
          buy: 99999,
          sell_count: 9,
          common: { twitter_username: "devx", tags: ["smart_money"], created_token_count: 3 },
        },
      },
      { data: { open_count: 2, tokens: [{ token_address: "t1", symbol: "AAA", market_cap: 10, token_ath_mc: 50, is_open: true }] } },
      {
        data: {
          activities: [
            { event_type: "buy", timestamp: 10, cost_usd: 42, token_amount: 999999, token: { symbol: "AAA" } },
            { type: "sell", timestamp: 11, amount_usd: 70, token: { symbol: "BBB" } },
            { event_type: "transferIn", timestamp: 12, cost_usd: 1, token: { symbol: "CCC" } },
          ],
        },
      },
    );
    assert.equal(dossier.buyCount, 14);
    assert.equal(dossier.sellCount, 9);
    assert.equal(dossier.winrate, 0.62);
    assert.equal(dossier.name, "devx");
    assert.equal(dossier.activity.length, 2);
    assert.equal(dossier.activity[0].amount, 42);
    assert.equal(dossier.activity[1].side, "sell");
    assert.equal(dossier.activity[1].amount, 70);
  });
});
