import { getSql } from "@/lib/db";
import type { AgentCard, AgentTick, AgentWeights } from "./types.ts";
import { DEFAULT_WEIGHTS } from "./types.ts";

export async function loadWeights(): Promise<AgentWeights> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ curve: number; sm: number; migrate: number }>(
      "select curve, sm, migrate from agent_weights where id = 1",
    );
    const row = rows[0];
    if (!row) return { ...DEFAULT_WEIGHTS };
    return {
      curve: Number(row.curve) || 1,
      sm: Number(row.sm) || 1,
      migrate: Number(row.migrate) || 1,
    };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export async function saveWeights(w: AgentWeights): Promise<void> {
  try {
    const sql = await getSql();
    await sql.query(
      "insert into agent_weights (id, curve, sm, migrate, updated_at) values (1, $1, $2, $3, now()) on conflict (id) do update set curve = $1, sm = $2, migrate = $3, updated_at = now()",
      [w.curve, w.sm, w.migrate],
    );
  } catch {
    /* preview may race migrations */
  }
}

export async function saveTicks(ticks: AgentTick[], kind: string, score: number): Promise<void> {
  if (!ticks.length) return;
  try {
    const sql = await getSql();
    for (const t of ticks.slice(0, 12)) {
      await sql.query(
        "insert into agent_ticks (address, symbol, stage, progress, market_cap, buy_ratio, ch5m, smart_degen, kind, score) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [t.address, t.symbol, t.stage, t.progress, t.marketCap, t.buyRatio, t.ch5m, t.smartDegen, kind, score],
      );
    }
  } catch {
    /* ignore */
  }
}

export async function saveSignals(signals: AgentCard[]): Promise<void> {
  if (!signals.length) return;
  try {
    const sql = await getSql();
    for (const s of signals) {
      await sql.query(
        "insert into agent_signals (kind, address, symbol, reason, score, stage) values ($1,$2,$3,$4,$5,$6)",
        [s.kind, s.address, s.symbol, s.reason, s.score, s.stage],
      );
    }
  } catch {
    /* ignore */
  }
}
