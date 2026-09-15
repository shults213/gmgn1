import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export function normalizeTwitterUsername(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const fromUrl = value.replace(/^@/, "");
  const cleaned = fromUrl
    .replace(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i, "")
    .replace(/^@/, "")
    .replace(/^\/+/, "")
    .split(/[/?#]/)[0]
    .trim();

  if (!cleaned) return null;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(cleaned)) return null;
  return cleaned;
}

export type TwitterUser = {
  userId?: string;
  screenName?: string;
  name?: string;
  description?: string;
  followersCount?: number;
  friendsCount?: number;
  statusesCount?: number;
  verified?: boolean;
};

export type TwitterTweet = {
  id?: string;
  text?: string;
  createdAt?: string;
  retweetCount?: number;
  favoriteCount?: number;
  replyCount?: number;
  userScreenName?: string;
};

export type TwitterIntelligence = {
  username: string;
  user: TwitterUser | null;
  tweets: TwitterTweet[];
};

const TWITTER_API_BASE = "https://ai.6551.io";

export const fetchTwitterIntelligence = createServerFn({ method: "GET" })
  .validator(z.object({ username: z.string().min(1) }))
  .handler(async ({ data }) => {
    const username = normalizeTwitterUsername(data.username);
    if (!username) throw new Error("Invalid X username format");

    const token = process.env.OPENNEWS_TOKEN;
    if (!token) throw new Error("Twitter integration is not configured (OPENNEWS_TOKEN missing)");

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const userResponse = await fetch(`${TWITTER_API_BASE}/open/twitter_user_info`, {
      method: "POST",
      headers,
      body: JSON.stringify({ username }),
    });
    if (!userResponse.ok) {
      throw new Error(`Twitter user lookup failed (${userResponse.status})`);
    }

    const userJson = (await userResponse.json()) as { data?: TwitterUser };
    let tweets: TwitterTweet[] = [];

    try {
      const tweetsResponse = await fetch(`${TWITTER_API_BASE}/open/twitter_user_tweets`, {
        method: "POST",
        headers,
        body: JSON.stringify({ username, maxResults: 5, product: "Latest" }),
      });

      if (tweetsResponse.ok) {
        const tweetsJson = (await tweetsResponse.json()) as { data?: TwitterTweet[] };
        tweets = Array.isArray(tweetsJson.data) ? tweetsJson.data : [];
      }
    } catch {
      tweets = [];
    }

    return {
      username,
      user: userJson.data ?? null,
      tweets,
    } satisfies TwitterIntelligence;
  });