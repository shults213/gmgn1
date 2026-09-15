import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(resolve(__dirname));

// Load env
process.env.GMGN_API_KEY = process.env.GMGN_API_KEY || "gmgn_47f23fd2a6b52e9655b7ba0573f4a617";
process.env.GMGN_DEBUG = "1";

// Import the internal function directly (bypasses TanStack RPC)
const { getDeskSnapshot } = await import("./src/lib/gmgn/client.server.ts");

console.log("=== TEST: fetchDeskSnapshot (pull=true) ===");
console.log("API Key:", process.env.GMGN_API_KEY?.slice(0, 12) + "...");

const start = Date.now();
try {
  const snap = await getDeskSnapshot("5m", "all", "trending", true);
  const elapsed = Date.now() - start;

  console.log("\n--- SNAPSHOT ---");
  console.log("elapsed:", elapsed + "ms");
  console.log("tokens:", snap.tokens.length);
  console.log("events:", snap.events.length);
  console.log("live:", snap.live);
  console.log("stale:", snap.stale);
  console.log("error:", snap.error);
  console.log("ticks:", snap.ticks);
  console.log("updatedAt:", snap.updatedAt ? new Date(snap.updatedAt).toISOString() : "none");
  console.log("cooldownLeft:", snap.cooldownLeft);
  console.log("banned:", snap.banned);
  console.log("source:", snap.source);
  console.log("stats:", snap.stats);
  console.log("agent:", snap.agent);

  if (snap.tokens.length > 0) {
    console.log("\n--- FIRST 3 TOKENS ---");
    snap.tokens.slice(0, 3).forEach((t, i) => {
      console.log(`${i + 1}. ${t.symbol} (${t.address.slice(0, 8)}...)`);
      console.log(`   price: $${t.price}, MC: $${t.marketCap}, vol: $${t.volume}`);
      console.log(`   5m: ${t.ch5m.toFixed(2)}%, 1h: ${t.ch1h.toFixed(2)}%, buyRatio: ${(t.buyRatio * 100).toFixed(0)}%`);
      console.log(`   stage: ${t.stage}, status: ${t.status}, rank: ${t.rank}, priority: ${t.priority}`);
      console.log(`   rug: ${(t.rugRatio * 100).toFixed(0)}%, honeypot: ${t.honeypot}, mintRenounced: ${t.renouncedMint}`);
      console.log(`   devScore: ${t.dev?.score ?? "—"}, smartDegen: ${t.smartDegen}, renowned: ${t.renowned}`);
      if (t.verdict) console.log(`   verdict: ${t.verdict.verdict} (${t.verdict.conviction}) ${t.verdict.reason}`);
      if (t.reason) console.log(`   REASON: ${t.reason}`);
    });
  }

  if (snap.events.length > 0) {
    console.log("\n--- FIRST 5 EVENTS ---");
    snap.events.slice(0, 5).forEach((e, i) => {
      console.log(`${i + 1}. ${e.event_type} | ${e.symbol} | ${e.side} | $${e.amount_usd ?? "?"} | ${new Date(e.ts * 1000).toISOString()}`);
    });
  }

  // bench stats
  const { benchStats } = await import("./src/lib/gmgn/http.server.ts");
  console.log("\n--- BENCH ---");
  console.log(benchStats());

  if (snap.tokens.length === 0 && snap.events.length === 0) {
    console.log("\n❌ NO DATA — check GMGN_DEBUG logs above for 429/errors");
    process.exit(1);
  } else {
    console.log("\n✅ DATA OK");
    process.exit(0);
  }
} catch (err) {
  console.error("\n❌ ERROR:", err.message);
  console.error(err.stack);
  process.exit(1);
}