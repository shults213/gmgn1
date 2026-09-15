export function proxiedLogo(src?: string | null): string | null {
  if (!src) return null;
  if (!isAllowedLogoHost(src)) return null;
  return `/api/logo?u=${encodeURIComponent(src)}`;
}

export function isAllowedLogoHost(src: string): boolean {
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    return u.hostname === "gmgn.ai" || u.hostname.endsWith(".gmgn.ai");
  } catch {
    return false;
  }
}

export function gmgnTokenUrl(chain: string, address: string): string {
  return `https://gmgn.ai/${chain || "sol"}/token/${address}`;
}

export function twitterHref(raw?: string | null): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").split(/[/?#]/)[0];
  if (!handle) return null;
  return `https://x.com/${handle}`;
}

export function webHref(raw?: string | null): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function telegramHref(raw?: string | null): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/^t\.me\//i, "");
  if (!handle) return null;
  return `https://t.me/${handle}`;
}
