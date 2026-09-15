import { createFileRoute } from "@tanstack/react-router";
import { isAllowedLogoHost } from "@/lib/links";

export const Route = createFileRoute("/api/logo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const src = new URL(request.url).searchParams.get("u") ?? "";
        if (!src || !isAllowedLogoHost(src)) {
          return new Response("forbidden", { status: 400 });
        }
        const hit = logoCache.get(src);
        if (hit && Date.now() - hit.at < TTL_MS) {
          return new Response(hit.body, {
            headers: {
              "Content-Type": hit.type,
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
        const remote = new URL(src);
        const via = `https://wsrv.nl/?url=${encodeURIComponent(`${remote.host}${remote.pathname}${remote.search}`)}&w=64&output=webp`;
        const upstream = await fetch(via, {
          headers: { "User-Agent": "gmgn-desk/1.0", Accept: "image/*" },
          redirect: "follow",
        });
        if (!upstream.ok) return new Response("upstream", { status: 502 });
        const body = await upstream.arrayBuffer();
        if (body.byteLength > 512_000) return new Response("too large", { status: 413 });
        const type = upstream.headers.get("content-type")?.split(";")[0] || "image/webp";
        if (!type.startsWith("image/")) return new Response("not an image", { status: 415 });
        logoCache.set(src, { at: Date.now(), type, body });
        if (logoCache.size > 400) {
          const first = logoCache.keys().next().value;
          if (first) logoCache.delete(first);
        }
        return new Response(body, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

const TTL_MS = 60 * 60 * 1000;
const logoCache = new Map<string, { at: number; type: string; body: ArrayBuffer }>();
