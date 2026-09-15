export type RankWeights = {
  mom5m: number;
  mom1h: number;
  buy_pressure: number;
  turnover: number;
  consensus: number;
  safety: number;
  dev: number;
  curve: number;
  migrate: number;
};

export type ScreeningConfig = {
  top_n_prefilter: number;
  require_renounced_mint: boolean;
  max_buy_tax: number;
  max_sell_tax: number;
  max_rug_ratio: number;
  max_bundler_ratio: number;
  max_dev_holding_pct: number;
  max_top10_concentration: number;
  min_smart_money_confluence: number;
  rank_weights: RankWeights;
  momentum_reject_chg1h: number;
  momentum_reject_chg5m: number;
  buy_ratio_pass: number;
  buy_ratio_reject: number;
  min_signal_conviction: number;
  dev_pool_n: number;
  min_dev_score: number;
};

export const DEFAULT_WEIGHTS: RankWeights = {
  mom5m: 30,
  mom1h: 12,
  buy_pressure: 18,
  turnover: 12,
  consensus: 12,
  safety: 10,
  dev: 12,
  curve: 18,
  migrate: 14,
};

/** Matches the user's Free-plan AITRADER env. */
export const DEFAULT_CONFIG: ScreeningConfig = {
  top_n_prefilter: 100,
  require_renounced_mint: true,
  max_buy_tax: 0.1,
  max_sell_tax: 0.1,
  max_rug_ratio: 0.6,
  max_bundler_ratio: 0.3,
  max_dev_holding_pct: 0.1,
  max_top10_concentration: 0.4,
  min_smart_money_confluence: 1,
  rank_weights: DEFAULT_WEIGHTS,
  momentum_reject_chg1h: -0.12,
  momentum_reject_chg5m: -0.06,
  buy_ratio_pass: 0.5,
  buy_ratio_reject: 0.42,
  min_signal_conviction: 0.6,
  dev_pool_n: 24,
  min_dev_score: 0.15,
};
