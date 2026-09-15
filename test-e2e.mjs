// E2E test: calls the running dev server's fetchDeskSnapshot RPC endpoint
// Run: GMGN_API_KEY=... GMGN_DEBUG=1 node test-e2e.mjs
// Requires: npm run dev running in another terminal on localhost:8080

const BASE = "http://localhost:8080";

async function callFetchDeskSnapshot(payload) {
  // TanStack Start server functions POST to /_server/<functionName>
  const res = await fetch(`${BASE}/_server/fetchDeskSnapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  console.log("=== E2E: fetchDeskSnapshot via dev server RPC ===");
  const payload = { feed: "trending", interval: "5m", platform: "all", pull: true };
  
  const start = Date.now();
  try {
    const snap = await callFetchDeskSnapshot(payload);
    const elapsed = Date.now() - start;
    
    console.log("\n--- SNAPSHOT ---");
    console.log("elapsed:", elapsed + "ms");
    console.log("tokens:", snap.tokens?.length ?? 0);
    console.log("events:", snap.events?.length ?? 0);
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
    
    if (snap.tokens?.length > 0) {
      console.log("\n--- FIRST 3 TOKENS ---");
      snap.tokens.slice(0, 3).forEach((t, i) => {
        console.log(`${i + 1}. ${t.symbol} (${t.address.slice(0, 8)}...) price=$${t.price} MC=$${t.marketCap} vol=$${t.volume}`);
        console.log(`   5m:${t.ch5m.toFixed(2)}% 1h:${t.ch1h.toFixed(2)}% buy%:${(t.buyRatio*100).toFixed(0)}% stage:${t.stage} status:${t.status} rank:${t.rank} priority:${t.priority}`);
        console.log(`   rug:${(t.rugRatio*100).toFixed(0)}% hp:${t.honeypot} mintRen:${t.renouncedMint} devScore:${t.dev?.score ?? "—"}`);
        if (t.verdict) console.log(`   verdict:${t.verdict.verdict}(${t.verdict.conviction}) ${t.verdict.reason}`);
        if (t.reason) console.log(`   REASON: ${t.reason}`);
      });
    }
    
    if (snap.events?.length > 0) {
      console.log("\n--- FIRST 5 EVENTS ---");
      snap.events.slice(0, 5).forEach((e, i) => {
        console.log(`${i + 1}. ${e.event_type} | ${e.symbol} | ${e.side} | $${e.amount_usd ?? "?"} | ${new Date(e.ts * 1000).toISOString()}`);
      });
    }
    
    if (!snap.tokens?.length && !snap.events?.length && snap.error) {
      console.log("\n❌ SERVER RETURNED ERROR:", snap.error);
      process.exit(1);
    } else if (!snap.tokens?.length && !snap.events?.length) {
      console.log("\n⚠️ EMPTY DATA (no error) — check server logs for [GMGN] lines");
      process.exit(0);
    } else {
      console.log("\n✅ FULL FLOW OK");
      process.exit(0);
    }
  } catch (err) {
    console.error("\n❌ REQUEST FAILED:", err.message);
    process.exit(1);
  }
}

main();