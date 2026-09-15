import { clamp } from "@/lib/utils";
import type { ScreeningConfig } from "./config";
import type { TokenFeatures } from "./features";

export const COMPONENT_LABELS: Record<string, string> = {
  mom5m: "5m Momentum",
  mom1h: "1h Momentum",
  buy_pressure: "Buy Pressure",
  turnover: "Turnover",
  consensus: "SM/KOL Consensus",
  safety: "Safety",
  dev: "Developer",
  curve: "Curve fill",
  migrate: "Fresh migrate",
};

export type ScorePart = {
  label: string;
  norm: number;
  weight: number;
  points: number;
};

export type ScoreBreakdown = {
  score: number;
  components: Record<string, ScorePart>;
  suppressed: boolean;
  raw_total: number;
  dev_included: boolean;
};

export type MomentumVerdict = {
  verdict: "pass" | "watch" | "reject";
  conviction: number;
  crowdedness: "early" | "crowded" | "late" | "fading" | "distributing";
  flags: string[];
  reason: string;
};

export function scoreComponents(
  f: TokenFeatures,
  cfg: ScreeningConfig,
  dev: number | null = null,
): ScoreBreakdown {
  const w = cfg.rank_weights;
  const parts: Record<string, number> = {
    mom5m: clamp((f.chg_5m + 0.05) / 0.3),
    mom1h: clamp((f.chg_1h + 0.1) / 0.6),
    buy_pressure: clamp((f.buy_ratio - 0.4) / 0.3),
    turnover: clamp(f.turnover / 3),
    consensus: clamp(Math.log10(1 + f.sm_confluence) / 2.5),
    safety:
      (f.renounced_mint && f.renounced_freeze ? 0.5 : 0) +
      0.5 * clamp((0.4 - f.top10) / 0.4),
  };
  if (f.stage === "pre_mig") parts.curve = clamp(f.progress);
  if (f.stage === "migrated") parts.migrate = clamp(1 - f.migrate_age_min / 90);
  if (dev != null) parts.dev = clamp(dev);

  let raw = 0;
  const components: Record<string, ScorePart> = {};
  for (const [key, norm] of Object.entries(parts)) {
    const weight = w[key as keyof typeof w] ?? 0;
    const points = weight * norm;
    raw += points;
    components[key] = {
      label: COMPONENT_LABELS[key] ?? key,
      norm: Math.round(norm * 10000) / 10000,
      weight,
      points: Math.round(points * 100) / 100,
    };
  }

  const suppressed = f.chg_1h <= cfg.momentum_reject_chg1h;
  const total = suppressed ? raw * 0.4 : raw;
  return {
    score: Math.max(0, Math.min(99, Math.round(total))),
    components,
    suppressed,
    raw_total: Math.round(raw * 100) / 100,
    dev_included: dev != null,
  };
}

export function momentumSignal(f: TokenFeatures, cfg: ScreeningConfig): MomentumVerdict {
  const up5 = f.chg_5m;
  const up1h = f.chg_1h;
  const buy = f.buy_ratio;
  const flags: string[] = [];
  if (f.sniper_count > 0) flags.push(`${f.sniper_count} sniper wallet(s) present`);

  if (up1h <= cfg.momentum_reject_chg1h && up5 <= cfg.momentum_reject_chg5m) {
    flags.unshift("1h and 5m both falling");
    return {
      verdict: "reject",
      conviction: 0.3,
      crowdedness: "fading",
      flags,
      reason: `Bleeding down (5m ${(up5 * 100).toFixed(0)}% / 1h ${(up1h * 100).toFixed(0)}%); downtrend, not chasing`,
    };
  }

  if (buy < cfg.buy_ratio_reject) {
    flags.unshift(`buy ratio only ${(buy * 100).toFixed(0)}%, sell pressure dominant`);
    return {
      verdict: "reject",
      conviction: Math.round(Math.min(0.5, 0.2 + buy) * 100) / 100,
      crowdedness: "distributing",
      flags,
      reason: `Sell pressure dominant (buy ratio ${(buy * 100).toFixed(0)}%); possible distribution`,
    };
  }

  const crowd: MomentumVerdict["crowdedness"] =
    up1h >= 3 ? "late" : up5 > 0 && up1h > 0 ? "early" : "crowded";
  if (crowd === "late") flags.push(`1h already ${(up1h * 100).toFixed(0)}%; late-entry risk`);

  const sMom = clamp((up5 + 0.05) / 0.25);
  const sBuy = clamp((buy - 0.45) / 0.2);
  let conv = 0.35 + 0.4 * sMom + 0.2 * sBuy + (up1h > 0 ? 0.05 : 0);
  if (crowd === "late") conv -= 0.05;
  conv = Math.round(Math.min(0.95, Math.max(0.3, conv)) * 100) / 100;

  const verdict = buy >= cfg.buy_ratio_pass && up5 > -0.02 ? "pass" : "watch";
  if (f.stage === "pre_mig" && f.progress >= 0.55 && buy >= cfg.buy_ratio_reject) {
    conv = Math.max(conv, 0.62);
    return {
      verdict: "pass",
      conviction: conv,
      crowdedness: "early",
      flags,
      reason: `Bonding ${Math.round(f.progress * 100)}% filled, buy ratio ${(buy * 100).toFixed(0)}%; pre-migration watch`,
    };
  }
  if (f.stage === "migrated" && f.migrate_age_min <= 60 && buy >= cfg.buy_ratio_reject && up5 > cfg.momentum_reject_chg5m) {
    conv = Math.max(conv, 0.62);
    return {
      verdict: "pass",
      conviction: conv,
      crowdedness: f.migrate_age_min < 15 ? "early" : "crowded",
      flags,
      reason: `Migrated ${Math.round(f.migrate_age_min)}m ago, buy ratio ${(buy * 100).toFixed(0)}%; post-migration window`,
    };
  }
  const reason =
    `5m ${(up5 * 100).toFixed(0)}% / 1h ${(up1h * 100).toFixed(0)}%, buy ratio ${(buy * 100).toFixed(0)}%; ` +
    (crowd === "late"
      ? "late but buy side still dominant; following the golden runner"
      : "price/volume rising with buy side dominant") +
    `; ${f.smart_degen} smart money + ${f.renowned} KOL present`;

  return { verdict, conviction: conv, crowdedness: crowd, flags, reason };
}
