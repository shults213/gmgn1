import type { DeskFeed, TrendingInterval, TrendingPlatform } from "../market/types.ts";

export type MarketFeedRequest = {
  method: "GET" | "POST";
  path: string;
  weight: number;
  query: Record<string, string | number | string[] | undefined>;
  body: Record<string, unknown> | null;
};

const CHAIN = "sol";
const SOL_QUOTE_ADDRESS_TYPES = [4, 5, 3, 1, 13, 0];

export const TRENCH_FEEDS = ["new_creation", "near_completion", "completed"] as const;
export type TrenchFeed = (typeof TRENCH_FEEDS)[number];

export const TRENCH_BUCKET: Record<TrenchFeed, "new_creation" | "pump" | "completed"> = {
  new_creation: "new_creation",
  near_completion: "pump",
  completed: "completed",
};

export function isTrenchesFeed(feed: DeskFeed): feed is TrenchFeed {
  return feed === "new_creation" || feed === "near_completion" || feed === "completed";
}

function trenchSection(platform: TrendingPlatform): Record<string, unknown> {
  const section: Record<string, unknown> = {
    filters: ["offchain", "onchain"],
    launchpad_platform_v2: true,
    limit: 80,
    quote_address_type: SOL_QUOTE_ADDRESS_TYPES,
  };
  if (platform !== "all") section.launchpad_platform = [platform];
  return section;
}

function trenchesBody(platform: TrendingPlatform): Record<string, unknown> {
  const section = trenchSection(platform);
  return {
    version: "v2",
    new_creation: { ...section },
    near_completion: { ...section },
    completed: { ...section },
  };
}

export function buildMarketFeedQuery(
  feed: DeskFeed,
  interval: TrendingInterval,
  platform: TrendingPlatform,
): MarketFeedRequest {
  if (feed === "hot_search") {
    return {
      method: "POST",
      path: "/v1/market/hot_searches",
      weight: 3,
      query: {},
      body: {
        params: [{ label: "hot-search", chain: CHAIN, interval, limit: 100 }],
      },
    };
  }

  if (isTrenchesFeed(feed)) {
    return {
      method: "POST",
      path: "/v1/trenches",
      weight: 3,
      query: { chain: CHAIN },
      body: trenchesBody(platform),
    };
  }

  return {
    method: "GET",
    path: "/v1/market/rank",
    weight: 1,
    query: {
      chain: CHAIN,
      interval,
      limit: 100,
      platforms: platform === "all" ? undefined : [platform],
      order_by: "volume",
      direction: "desc",
    },
    body: null,
  };
}
