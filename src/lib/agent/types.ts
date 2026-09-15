import type { MigrationStage } from "@/lib/market/types";

export type AgentKind = "watch" | "alert" | "drop";

export type AgentCard = {
  address: string;
  symbol: string;
  name: string;
  kind: AgentKind;
  reason: string;
  stage: MigrationStage;
  progress: number;
  score: number;
  ts: number;
};

export type AgentState = {
  focus: AgentCard[];
  watching: number;
};

export type AgentTick = {
  address: string;
  symbol: string;
  name: string;
  stage: MigrationStage;
  progress: number;
  marketCap: number;
  buyRatio: number;
  ch5m: number;
  smartDegen: number;
  renowned: number;
  rugRatio: number;
  bundler: number;
  creatorClose: boolean;
  honeypot: boolean;
  status: "survivor" | "rejected" | "pending";
  reasonCode: string | null;
  completeAt: number;
  ts: number;
};

export type AgentWeights = {
  curve: number;
  sm: number;
  migrate: number;
};

export const EMPTY_AGENT: AgentState = { focus: [], watching: 0 };

export const DEFAULT_WEIGHTS: AgentWeights = { curve: 1, sm: 1, migrate: 1 };
