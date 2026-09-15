import type { DeskToken, FlowEvent } from "@/lib/market/types";
import { emptyMemory, learnFromTransition, stepAgent, type AgentMemory } from "./brain.ts";
import { saveSignals, saveTicks, saveWeights, loadWeights } from "./memory.server.ts";
import type { AgentCard, AgentState, AgentTick } from "./types.ts";
import { EMPTY_AGENT } from "./types.ts";

let mem: AgentMemory = emptyMemory();
let loaded = false;

function toTick(t: DeskToken, now: number): AgentTick {
  return {
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    stage: t.stage ?? "listed",
    progress: t.progress ?? 0,
    marketCap: t.marketCap,
    buyRatio: t.buyRatio,
    ch5m: t.ch5m,
    smartDegen: t.smartDegen,
    renowned: t.renowned,
    rugRatio: t.rugRatio,
    bundler: t.bundler,
    creatorClose: t.creatorClose,
    honeypot: t.honeypot,
    status: t.status,
    reasonCode: t.reasonCode,
    completeAt: t.completeAt ?? 0,
    ts: now,
  };
}

export function agentSnapshot(): AgentState {
  return {
    focus: mem.focus,
    watching: mem.focus.length,
  };
}

export function runAgent(tokens: DeskToken[], events: FlowEvent[]): AgentCard[] {
  const now = Date.now();
  if (!loaded) {
    loaded = true;
    void loadWeights().then((w) => {
      mem.weights = w;
    });
  }

  const ticks = tokens.map((t) => toTick(t, now));
  for (const t of ticks) {
    mem.weights = learnFromTransition(mem.prev.get(t.address), t, mem.weights);
  }

  const tapeSm = new Set<string>();
  for (const e of events) {
    if (e.event_type.startsWith("smart_money") || e.event_type.includes("smart_money_buy")) {
      tapeSm.add(e.token_address);
    }
  }

  const out = stepAgent(ticks, tapeSm, mem, now);
  mem = out.mem;

  if (out.signals.length) {
    void saveSignals(out.signals);
    const interesting = ticks.filter((t) => out.focus.some((f) => f.address === t.address));
    void saveTicks(interesting, out.signals[0]?.kind ?? "tick", out.focus[0]?.score ?? 0);
    void saveWeights(mem.weights);
  }

  return out.signals;
}

export function resetAgent() {
  mem = emptyMemory();
  loaded = false;
}

export { EMPTY_AGENT };
