import type { AgentCard, AgentKind, AgentTick, AgentWeights } from "./types.ts";
import { DEFAULT_WEIGHTS } from "./types.ts";

const FOCUS_N = 3;
const SIGNAL_COOL_MS = 180_000;

export type AgentMemory = {
  prev: Map<string, AgentTick>;
  focus: AgentCard[];
  lastSignal: Map<string, { kind: AgentKind; at: number }>;
  weights: AgentWeights;
};

export function emptyMemory(weights: AgentWeights = DEFAULT_WEIGHTS): AgentMemory {
  return { prev: new Map(), focus: [], lastSignal: new Map(), weights };
}

function clamp(n: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, n));
}

function veto(t: AgentTick): string | null {
  if (t.honeypot) return "honeypot";
  if (t.creatorClose) return "dev exited";
  if (t.rugRatio > 0.55) return "rug";
  if (t.bundler > 0.35) return "bundler";
  if (t.reasonCode === "honeypot" || t.reasonCode === "bundler" || t.reasonCode === "rug_ratio") {
    return t.reasonCode;
  }
  return null;
}

function migrateAgeMin(t: AgentTick, now: number) {
  if (!t.completeAt) return 99;
  return Math.max(0, (now / 1000 - t.completeAt) / 60);
}

export function scoreTick(
  t: AgentTick,
  prev: AgentTick | undefined,
  tapeSm: boolean,
  w: AgentWeights,
  now: number,
): { score: number; kind: AgentKind; reason: string } | null {
  const blocked = veto(t);
  if (blocked) {
    if (prev) return { score: 0, kind: "drop", reason: blocked };
    return null;
  }

  const interesting = t.stage === "pre_mig" || t.stage === "migrated" || t.stage === "fresh" || t.smartDegen >= 2;
  if (!interesting) return null;

  let score = 0;
  const reasons: string[] = [];

  if (t.stage === "pre_mig") {
    score += 42 * t.progress * w.curve;
    reasons.push(`curve ${Math.round(t.progress * 100)}%`);
    if (prev && t.progress - prev.progress >= 0.04) {
      score += 22 * w.curve;
      reasons.push("filling");
    }
  } else if (t.stage === "migrated") {
    const age = migrateAgeMin(t, now);
    const fresh = clamp(1 - age / 60);
    score += 36 * fresh * w.migrate;
    reasons.push(age < 60 ? `post ${Math.round(age)}m` : "migrated");
  } else if (t.stage === "fresh") {
    score += 10;
    reasons.push("new");
  }

  score += 16 * clamp((t.buyRatio - 0.45) / 0.25);
  if (t.buyRatio >= 0.55) reasons.push(`buy ${Math.round(t.buyRatio * 100)}%`);
  score += 10 * clamp(t.ch5m / 18);
  if (t.ch5m >= 8) reasons.push(`5m ${t.ch5m.toFixed(0)}%`);
  score += 12 * clamp(t.smartDegen / 8) * w.sm;
  if (t.smartDegen >= 1) reasons.push(`SM ${t.smartDegen}`);
  score += 6 * clamp(t.renowned / 6);
  if (tapeSm) {
    score += 14 * w.sm;
    reasons.push("tape SM");
  }

  if (t.buyRatio < 0.42 || t.ch5m <= -8) {
    return { score, kind: "drop", reason: t.buyRatio < 0.42 ? "sell pressure" : "5m dump" };
  }

  if (t.stage === "pre_mig" && t.progress >= 0.8 && t.buyRatio >= 0.5 && score >= 62) {
    return { score, kind: "alert", reason: reasons.slice(0, 3).join(" · ") };
  }
  if (t.stage === "migrated" && migrateAgeMin(t, now) <= 25 && t.buyRatio >= 0.52 && (tapeSm || t.smartDegen >= 1) && score >= 58) {
    return { score, kind: "alert", reason: reasons.slice(0, 3).join(" · ") };
  }
  if (score >= 46) return { score, kind: "watch", reason: reasons.slice(0, 3).join(" · ") };
  return null;
}

export function stepAgent(
  ticks: AgentTick[],
  tapeAddrs: Set<string>,
  mem: AgentMemory,
  now = Date.now(),
): { mem: AgentMemory; signals: AgentCard[]; focus: AgentCard[] } {
  const ranked: AgentCard[] = [];
  const drops: AgentCard[] = [];

  for (const t of ticks) {
    const prev = mem.prev.get(t.address);
    const hit = scoreTick(t, prev, tapeAddrs.has(t.address), mem.weights, now);
    mem.prev.set(t.address, t);
    if (!hit) continue;
    const card: AgentCard = {
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      kind: hit.kind,
      reason: hit.reason,
      stage: t.stage,
      progress: t.progress,
      score: Math.round(hit.score),
      ts: now,
    };
    if (hit.kind === "drop") drops.push(card);
    else ranked.push(card);
  }

  ranked.sort((a, b) => b.score - a.score);

  const kept: AgentCard[] = [];
  for (const old of mem.focus) {
    const still = ranked.find((c) => c.address === old.address);
    if (still) kept.push(still);
  }
  const focus: AgentCard[] = [...kept];
  for (const c of ranked) {
    if (focus.length >= FOCUS_N) break;
    if (focus.some((f) => f.address === c.address)) continue;
    focus.push(c);
  }

  const signals: AgentCard[] = [];
  for (const card of [...focus, ...drops.filter((d) => mem.focus.some((f) => f.address === d.address))]) {
    const last = mem.lastSignal.get(card.address);
    if (last && last.kind === card.kind && now - last.at < SIGNAL_COOL_MS) continue;
    mem.lastSignal.set(card.address, { kind: card.kind, at: now });
    signals.push(card);
  }

  for (const [addr, tick] of mem.prev) {
    if (now - tick.ts > 30 * 60_000) mem.prev.delete(addr);
  }

  const next: AgentMemory = { ...mem, focus };
  return { mem: next, signals, focus };
}

export function learnFromTransition(prev: AgentTick | undefined, next: AgentTick, w: AgentWeights): AgentWeights {
  if (!prev) return w;
  const curve = w.curve;
  const sm = w.sm;
  const migrate = w.migrate;
  if (prev.stage === "pre_mig" && next.stage === "migrated") {
    return { curve: clamp(curve * 1.03, 0.6, 1.6), sm, migrate: clamp(migrate * 1.02, 0.6, 1.6) };
  }
  if (prev.stage === "migrated" && next.buyRatio < 0.4 && prev.buyRatio >= 0.5) {
    return { curve, sm: clamp(sm * 0.98, 0.6, 1.6), migrate: clamp(migrate * 0.98, 0.6, 1.6) };
  }
  return w;
}
