import { useState } from "react";
import type { ReactNode } from "react";
import { Star, X } from "lucide-react";
import { formatChange, formatPct, formatPrice, formatUsd, shortAddr, timeAgo } from "@/lib/format";
import { gmgnTokenUrl, telegramHref, twitterHref, webHref } from "@/lib/links";
import type { DeskToken } from "@/lib/market/types";
import { fetchTwitterIntelligence, normalizeTwitterUsername, type TwitterIntelligence } from "@/lib/twitter/api";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";
import { TokenMark, Tone } from "./mark";
import { Sparkline } from "./sparkline";

export function Dossier({ token }: { token: DeskToken }) {
  const [twitter, setTwitter] = useState<TwitterIntelligence | null>(null);
  const [twitterLoading, setTwitterLoading] = useState(false);
  const [twitterError, setTwitterError] = useState<string | null>(null);
  const close = () => useDesk.getState().selectToken(null);
  const fav = useDesk((s) => s.favorites.includes(token.address));
  const toggleFav = useDesk((s) => s.toggleFav);
  const selectWallet = useDesk((s) => s.selectWallet);
  const events = useDesk((s) => s.events);
  const related = events.filter((e) => e.token_address === token.address).slice(0, 8);

  const parts = token.scoreParts?.components
    ? Object.entries(token.scoreParts.components)
    : [];
  const twitterUsername = normalizeTwitterUsername(token.twitter);

  const loadTwitter = async () => {
    if (!twitterUsername || twitterLoading) return;
    setTwitterLoading(true);
    setTwitterError(null);
    try {
      setTwitter(await fetchTwitterIntelligence({ data: { username: twitterUsername } }));
    } catch (error) {
      setTwitterError(error instanceof Error ? error.message : "Twitter request failed");
    } finally {
      setTwitterLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-start gap-2 border-b border-line px-3 py-2.5">
        <TokenMark symbol={token.symbol} logo={token.logo} className="mt-0.5 size-7" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="truncate text-desk font-medium">{token.symbol}</h2>
            <span className="truncate text-tiny text-muted">{token.name}</span>
          </div>
          <button
            type="button"
            className="text-micro text-faint hover:text-gold"
            onClick={() => navigator.clipboard?.writeText(token.address)}
          >
            {shortAddr(token.address, 6, 6)}
          </button>
          <TokenLinks token={token} />
          {twitterUsername ? (
            <button
              type="button"
              onClick={() => void loadTwitter()}
              className="mt-1.5 rounded-sm border border-line px-1.5 py-0.5 text-micro tracking-[0.12em] text-steel hover:border-gold/50 hover:text-gold"
            >
              {twitterLoading ? "LOADING X" : "ANALYZE X"}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={fav ? "Remove favorite" : "Favorite"}
          onClick={() => toggleFav(token.address)}
          className="grid size-7 place-items-center"
        >
          <Star className={cn("size-3.5", fav ? "fill-gold text-gold" : "text-faint")} />
        </button>
        <button
          type="button"
          aria-label="Close dossier"
          onClick={close}
          className="grid size-7 place-items-center text-muted hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {twitterUsername && (twitter || twitterError) ? (
          <TwitterSection data={twitter} error={twitterError} />
        ) : null}
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="desk-nums text-lg leading-none">{formatPrice(token.price)}</div>
            <div className="mt-1 flex gap-2 text-tiny">
              <Tone tone={token.ch5m >= 0 ? "buy" : "sell"}>{formatChange(token.ch5m)} 5m</Tone>
              <Tone tone={token.ch1h >= 0 ? "buy" : "sell"}>{formatChange(token.ch1h)} 1h</Tone>
            </div>
          </div>
          <Sparkline points={token.spark} className="h-8 w-28" />
        </div>

        <div className="mb-3 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-line bg-line">
          <Stat label="MC" value={formatUsd(token.marketCap)} />
          <Stat label="Liq" value={formatUsd(token.liquidity)} />
          <Stat label="Vol" value={formatUsd(token.volume)} />
          <Stat label="Holders" value={String(token.holders)} />
          <Stat label="Age" value={timeAgo(token.createdAt)} />
          <Stat label="Priority" value={token.priority == null ? "—" : String(token.priority)} gold />
          <Stat
            label="Stage"
            value={
              token.stage === "pre_mig"
                ? `PRE ${Math.round(token.progress * 100)}%`
                : token.stage === "migrated"
                  ? token.completeAt
                    ? `POST ${timeAgo(token.completeAt)}`
                    : "POST"
                  : token.stage === "fresh"
                    ? "NEW"
                    : token.exchange || "listed"
            }
            gold={token.stage === "pre_mig" || token.stage === "migrated"}
          />
          <Stat label="Venue" value={token.exchange || token.launchpad || "—"} />
        </div>

        <Section title="Security">
          <div className="flex flex-wrap gap-1">
            <Chip ok={!token.honeypot} label={token.honeypot ? "Honeypot" : "Not honeypot"} />
            <Chip ok={token.renouncedMint} label={token.renouncedMint ? "Mint renounced" : "Mint open"} />
            <Chip ok={token.renouncedFreeze} label={token.renouncedFreeze ? "Freeze renounced" : "Freeze open"} />
            <Chip ok={!token.creatorClose} label={token.creatorClose ? "Dev exited" : "Dev holding"} />
            {token.cto ? <Chip ok label="CTO" /> : null}
            <Chip ok={token.rugRatio < 0.3} label={`Rug ${Math.round(token.rugRatio * 100)}%`} />
            <Chip ok={token.bundler < 0.3} label={`Bundler ${Math.round(token.bundler * 100)}%`} />
            <Chip ok={token.top10 < 0.4} label={`Top10 ${Math.round(token.top10 * 100)}%`} />
          </div>
        </Section>

        {parts.length > 0 ? (
          <Section title="Priority breakdown">
            <div className="space-y-1.5">
              {parts.map(([key, part]) => (
                <div key={key} className="grid grid-cols-[1fr_36px] items-center gap-2">
                  <div>
                    <div className="flex justify-between text-micro text-muted">
                      <span>{part.label}</span>
                      <span className="desk-nums">{part.points.toFixed(1)}</span>
                    </div>
                    <div className="mt-0.5 h-1 rounded-full bg-raised">
                      <div
                        className="h-1 rounded-full bg-gold/80"
                        style={{ width: `${Math.min(100, part.norm * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="desk-nums text-right text-micro text-faint">{part.weight}</span>
                </div>
              ))}
            </div>
            {token.verdict ? (
              <p className="mt-2 text-tiny leading-snug text-muted">{token.verdict.reason}</p>
            ) : null}
            {token.reason && token.status === "rejected" ? (
              <p className="mt-2 text-tiny leading-snug text-sell">{token.reason}</p>
            ) : null}
          </Section>
        ) : token.reason ? (
          <Section title="Gate">
            <p className="text-tiny text-muted">{token.reason}</p>
          </Section>
        ) : null}

        <Section title="Developer">
          <button
            type="button"
            className="text-tiny text-gold hover:underline"
            onClick={() => selectWallet(token.creator)}
          >
            {shortAddr(token.creator, 6, 6)}
          </button>
          {token.launchpad ? (
            <p className="mt-1 text-micro tracking-[0.12em] text-faint">{token.launchpad}</p>
          ) : null}
          {token.dev ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-tiny">
              <KV k="Score" v={token.dev.score == null ? "—" : String(Math.round(token.dev.score * 100))} />
              <KV k="Launches" v={String(token.dev.analyzed ?? "—")} />
              <KV k="Alive" v={String(token.dev.alive ?? "—")} />
              <KV k="Rugged" v={String(token.dev.rugged ?? "—")} />
              <KV k="Inner" v={String(token.dev.inner_count ?? "—")} />
              <KV k="ATH" v={formatUsd(token.dev.ath_mc)} />
            </dl>
          ) : (
            <p className="mt-1 text-tiny text-faint">Not in the current dev pool.</p>
          )}
        </Section>

        <Section title="Tape">
          {related.length === 0 ? (
            <p className="text-tiny text-faint">No recent prints for this mint.</p>
          ) : (
            <ul className="space-y-1">
              {related.map((e) => (
                <li key={e.key} className="flex justify-between text-tiny">
                  <span className="text-muted">{e.event_type.replace(/_/g, " ")}</span>
                  <span className="desk-nums text-fg">
                    {e.amount_usd != null ? formatUsd(e.amount_usd) : timeAgo(e.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="mt-4 text-micro text-faint">
          {token.launchpad} · tax {formatPct(token.buyTax)} / {formatPct(token.sellTax)} · SM {token.smartDegen} ·
          KOL {token.renowned}
        </p>
      </div>
    </div>
  );
}

function TwitterSection({ data, error }: { data: TwitterIntelligence | null; error: string | null }) {
  if (error) {
    return (
      <Section title="Twitter intelligence">
        <p className="text-tiny text-sell">{error}</p>
      </Section>
    );
  }
  if (!data) return null;
  return (
    <Section title="Twitter intelligence">
      {data.user ? (
        <div className="mb-2 text-tiny">
          <div className="flex justify-between gap-2">
            <span className="text-fg">{data.user.name || `@${data.username}`}</span>
            <span className="desk-nums text-muted">{data.user.followersCount ?? 0} followers</span>
          </div>
          {data.user.description ? <p className="mt-1 text-micro text-muted">{data.user.description}</p> : null}
        </div>
      ) : null}
      {data.tweets.length > 0 ? (
        <ul className="space-y-1.5">
          {data.tweets.map((tweet) => (
            <li key={tweet.id ?? tweet.createdAt} className="border-l border-line pl-2 text-micro text-muted">
              {tweet.text || "(empty tweet)"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-tiny text-faint">No recent tweets.</p>
      )}
    </Section>
  );
}

function TokenLinks({ token }: { token: DeskToken }) {
  const x = twitterHref(token.twitter);
  const site = webHref(token.website);
  const tg = telegramHref(token.telegram);
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <Out href={gmgnTokenUrl(token.chain, token.address)} label="GMGN" />
      {x ? <Out href={x} label="X" /> : null}
      {site ? <Out href={site} label="Site" /> : null}
      {tg ? <Out href={tg} label="TG" /> : null}
    </div>
  );
}

function Out({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-sm border border-line px-1.5 py-0.5 text-micro tracking-[0.12em] text-gold hover:border-gold/50"
    >
      {label}
    </a>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 text-micro tracking-[0.16em] text-gold-dim">{title.toUpperCase()}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="bg-surface px-2 py-1.5">
      <div className="text-micro tracking-[0.1em] text-faint">{label}</div>
      <div className={cn("desk-nums text-tiny", gold ? "text-gold" : "text-fg")}>{value}</div>
    </div>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-sm border px-1.5 py-0.5 text-micro",
        ok ? "border-buy/25 text-buy" : "border-sell/30 text-sell",
      )}
    >
      {label}
    </span>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="desk-nums text-right text-fg">{v}</dd>
    </>
  );
}
