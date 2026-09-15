import type { ScreeningConfig } from "./config";
import type { TokenFeatures } from "./features";

export const GATE_RUG = 1;
export const GATE_CONSENSUS = 2;
export const GATE_RANK = 3;
export const GATE_SIGNAL = 4;

export type GateResult = {
  passed: boolean;
  gate: number;
  reason_code: string;
  reason: string;
};

export function hardGates(f: TokenFeatures, cfg: ScreeningConfig): GateResult {
  if (f.honeypot) {
    return { passed: false, gate: GATE_RUG, reason_code: "honeypot", reason: "Honeypot detected" };
  }
  if (cfg.require_renounced_mint && !f.renounced_mint) {
    return {
      passed: false,
      gate: GATE_RUG,
      reason_code: "mint_not_renounced",
      reason: "Mint authority not renounced (unlimited mint possible)",
    };
  }
  if (f.buy_tax > cfg.max_buy_tax || f.sell_tax > cfg.max_sell_tax) {
    return {
      passed: false,
      gate: GATE_RUG,
      reason_code: "high_tax",
      reason: `Tax too high (buy ${(f.buy_tax * 100).toFixed(0)}% / sell ${(f.sell_tax * 100).toFixed(0)}%)`,
    };
  }
  if (f.rug_ratio > cfg.max_rug_ratio) {
    return {
      passed: false,
      gate: GATE_RUG,
      reason_code: "rug_ratio",
      reason: `Rug ratio ${(f.rug_ratio * 100).toFixed(0)}% above ${(cfg.max_rug_ratio * 100).toFixed(0)}%`,
    };
  }
  if (f.bundler > cfg.max_bundler_ratio) {
    return {
      passed: false,
      gate: GATE_RUG,
      reason_code: "bundler",
      reason: `Bundler ${(f.bundler * 100).toFixed(0)}% above ${(cfg.max_bundler_ratio * 100).toFixed(0)}%`,
    };
  }
  if (f.dev_hold > cfg.max_dev_holding_pct) {
    return {
      passed: false,
      gate: GATE_RUG,
      reason_code: "dev_hold",
      reason: `Dev holdings ${(f.dev_hold * 100).toFixed(0)}% above ${(cfg.max_dev_holding_pct * 100).toFixed(0)}%`,
    };
  }
  if (f.top10 > cfg.max_top10_concentration) {
    return {
      passed: false,
      gate: GATE_RUG,
      reason_code: "top10",
      reason: `Top-10 concentration ${(f.top10 * 100).toFixed(0)}% above ${(cfg.max_top10_concentration * 100).toFixed(0)}%`,
    };
  }
  if (f.stage !== "fresh" && f.stage !== "pre_mig" && f.sm_confluence < cfg.min_smart_money_confluence) {
    return {
      passed: false,
      gate: GATE_CONSENSUS,
      reason_code: "consensus",
      reason: `Consensus too low: smart money + KOL = ${f.sm_confluence}`,
    };
  }
  return { passed: true, gate: 0, reason_code: "", reason: "ok" };
}

export const REJECT_LABEL: Record<string, string> = {
  honeypot: "HONEYPOT",
  mint_not_renounced: "NO RENOUNCE",
  high_tax: "HIGH TAX",
  rug_ratio: "HIGH RUG",
  bundler: "BUNDLER",
  dev_hold: "DEV HOLD",
  top10: "TOP-10",
  consensus: "LOW CONSENSUS",
  low_dev_score: "LOW DEV",
  signal_reject: "SIGNAL REJECT",
  signal_watch: "WATCH",
  low_conviction: "LOW CONV",
};
