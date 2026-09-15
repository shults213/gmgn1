import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DeskFeed, DeskSnapshot, TrendingInterval, TrendingPlatform } from "@/lib/market/types";

export type { DeskSnapshot };

export const fetchDeskSnapshot = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        feed: z.enum(["trending", "new_creation", "near_completion", "completed", "hot_search"]).optional(),
        interval: z.enum(["1m", "5m", "1h", "6h", "24h"]).optional(),
        platform: z.enum(["all", "Pump.fun", "letsbonk", "pump_agent", "bags", "Moonshot"]).optional(),
        pull: z.boolean().optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const { getDeskSnapshot } = await import("./client.server");
    return getDeskSnapshot(
      (data?.interval ?? "5m") as TrendingInterval,
      (data?.platform ?? "all") as TrendingPlatform,
      (data?.feed ?? "trending") as DeskFeed,
      data?.pull === true,
    );
  });

export const fetchWalletDossier = createServerFn({ method: "GET" })
  .validator(z.object({ address: z.string().min(20).max(88) }))
  .handler(async ({ data }) => {
    const { getWalletDossier } = await import("./client.server");
    return getWalletDossier(data.address);
  });
