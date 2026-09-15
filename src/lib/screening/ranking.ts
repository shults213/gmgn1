import type { TrendingRow } from "@/lib/market/types";
import type { ScreeningConfig } from "./config";
import { buildFromRow, type TokenFeatures } from "./features";
import { GATE_RANK, GATE_SIGNAL, hardGates } from "./gates";
import { momentumSignal, scoreComponents, type MomentumVerdict, type ScoreBreakdown } from "./scoring";
import { devRejectReason, devScore, publicDev, type DevProfile, type PublicDev } from "./developer";

export type Candidate = {
  features: TokenFeatures;
  status: "survivor" | "rejected" | "pending";
  gate: number | null;
  reason_code: string | null;
  reason: string | null;
  priority_score: number;
  score_parts: ScoreBreakdown | null;
  dev: PublicDev | null;
  dev_score: number | null;
  verdict: MomentumVerdict | null;
  rank: number;
};

export type ScreeningStats = {
  universe: number;
  prefiltered: number;
  features_built: number;
  gate1_survivors: number;
  gate2_survivors: number;
  dev_pool: number;
  dev_evaluated: number;
  dev_rejected: number;
  signal_survivors: number;
};

export type ScreeningResult = {
  chain: string;
  ran_at: number;
  candidates: Candidate[];
  stats: ScreeningStats;
};

export function screenRows(
  rows: TrendingRow[],
  cfg: ScreeningConfig,
  profiles: Record<string, DevProfile | null | undefined>,
  chain = "sol",
): ScreeningResult {
  const now = Date.now() / 1000;
  const universe = rows.length;
  const pref = rows.slice(0, cfg.top_n_prefilter);

  const rejected: Candidate[] = [];
  const gateSurvivors: Candidate[] = [];
  let built = 0;
  let gate1Fails = 0;


  for (const row of pref) {
    if (!row.address) continue;
    built += 1;
    const f = buildFromRow(row, now);
    const gate = hardGates(f, cfg);
    const cand: Candidate = {
      features: f,
      status: "pending",
      gate: null,
      reason_code: null,
      reason: null,
      priority_score: 0,
      score_parts: null,
      dev: null,
      dev_score: null,
      verdict: null,
      rank: 0,
    };
    if (!gate.passed) {
      cand.status = "rejected";
      cand.gate = gate.gate;
      cand.reason_code = gate.reason_code;
      cand.reason = gate.reason;
      if (gate.gate === 1) gate1Fails += 1;
      rejected.push(cand);
    } else {
      gateSurvivors.push(cand);
    }
  }

  for (const cand of gateSurvivors) {
    const parts = scoreComponents(cand.features, cfg);
    cand.priority_score = parts.score;
    cand.score_parts = parts;
  }
  gateSurvivors.sort((a, b) => b.priority_score - a.priority_score);

  const pool = gateSurvivors.slice(0, cfg.dev_pool_n);
  const rest = gateSurvivors.slice(cfg.dev_pool_n);
  let devEvaluated = 0;
  const devOk: Candidate[] = [];

  for (const cand of pool) {
    const profile = profiles[cand.features.address] ?? null;
    if (profile) devEvaluated += 1;
    cand.dev_score = devScore(profile);
    cand.dev = publicDev(profile, cand.dev_score);
    const skipDev = cand.features.stage === "fresh" || cand.features.stage === "pre_mig";
    if (!skipDev && cand.dev_score < cfg.min_dev_score) {
      cand.status = "rejected";
      cand.gate = GATE_RANK;
      cand.reason_code = "low_dev_score";
      cand.reason = devRejectReason(cand.dev_score, profile);
      rejected.push(cand);
      continue;
    }
    const parts = scoreComponents(cand.features, cfg, cand.dev_score);
    cand.priority_score = parts.score;
    cand.score_parts = parts;
    devOk.push(cand);
  }
  devOk.sort((a, b) => b.priority_score - a.priority_score);

  const ranked = [...devOk, ...rest];
  const survivors: Candidate[] = [];
  for (const cand of ranked) {
    const verdict = momentumSignal(cand.features, cfg);
    cand.verdict = verdict;
    const early = cand.features.stage === "fresh" || cand.features.stage === "pre_mig" || cand.features.stage === "migrated";
    if (verdict.verdict === "reject") {
      cand.status = "rejected";
      cand.gate = GATE_SIGNAL;
      cand.reason_code = `signal_${verdict.verdict}`;
      cand.reason = verdict.reason;
      rejected.push(cand);
      continue;
    }
    if (!early && verdict.verdict !== "pass") {
      cand.status = "rejected";
      cand.gate = GATE_SIGNAL;
      cand.reason_code = `signal_${verdict.verdict}`;
      cand.reason = verdict.reason;
      rejected.push(cand);
      continue;
    }
    if (!early && verdict.conviction < cfg.min_signal_conviction) {
      cand.status = "rejected";
      cand.gate = GATE_SIGNAL;
      cand.reason_code = "low_conviction";
      cand.reason = `Low signal conviction ${verdict.conviction.toFixed(2)} < ${cfg.min_signal_conviction}`;
      rejected.push(cand);
      continue;
    }
    cand.status = "survivor";
    survivors.push(cand);
  }

  survivors.sort((a, b) => b.priority_score - a.priority_score);
  rejected.sort((a, b) => (b.score_parts ? b.priority_score : -1) - (a.score_parts ? a.priority_score : -1));
  const ordered = [...survivors, ...rejected];
  ordered.forEach((c, i) => {
    c.rank = i + 1;
  });

  return {
    chain,
    ran_at: now,
    candidates: ordered,
    stats: {
      universe,
      prefiltered: pref.length,
      features_built: built,
      gate1_survivors: built - gate1Fails,
      gate2_survivors: gateSurvivors.length,
      dev_pool: pool.length,
      dev_evaluated: devEvaluated,
      dev_rejected: pool.length - devOk.length,
      signal_survivors: survivors.length,
    },
  };
}
