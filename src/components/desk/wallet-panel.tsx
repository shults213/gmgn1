import { useEffect } from "react";
import { X } from "lucide-react";
import { formatPct, formatUsd, shortAddr, timeAgo } from "@/lib/format";
import { useDesk } from "@/lib/store";
import { Tone } from "./mark";

export function WalletPanel({ address }: { address: string }) {
  const dossier = useDesk((s) => s.wallets[address] ?? null);
  const loading = useDesk((s) => s.walletLoading === address);
  const error = useDesk((s) => s.walletError);
  const close = () => useDesk.getState().selectWallet(null);
  const selectToken = useDesk((s) => s.selectToken);
  const loadWallet = useDesk((s) => s.loadWallet);

  useEffect(() => {
    void loadWallet(address);
  }, [address, loadWallet]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-start justify-between gap-2 border-b border-line px-3 py-2.5">
        <div>
          <div className="text-micro tracking-[0.16em] text-gold-dim">WALLET</div>
          <h2 className="desk-nums text-desk">{shortAddr(address, 6, 6)}</h2>
          {dossier?.name ? <div className="text-tiny text-steel">@{dossier.name}</div> : null}
        </div>
        <button
          type="button"
          aria-label="Close wallet"
          onClick={close}
          className="grid size-7 place-items-center text-muted hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {loading && !dossier ? (
          <p className="text-tiny text-muted">Loading wallet from GMGN…</p>
        ) : null}
        {error && !dossier ? <p className="text-tiny text-sell">{error}</p> : null}
        {dossier ? (
          <>
            <div className="mb-3 flex flex-wrap gap-1">
              {dossier.tags.map((t) => (
                <span key={t} className="rounded-sm border border-line px-1.5 py-0.5 text-micro text-muted">
                  {t}
                </span>
              ))}
            </div>
            <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-tiny">
              <dt className="text-muted">Realized</dt>
              <dd className="text-right">
                <Tone tone={dossier.realized >= 0 ? "buy" : "sell"}>{formatUsd(dossier.realized)}</Tone>
              </dd>
              <dt className="text-muted">Unrealized</dt>
              <dd className="text-right">
                <Tone tone={dossier.unrealized >= 0 ? "buy" : "sell"}>{formatUsd(dossier.unrealized)}</Tone>
              </dd>
              <dt className="text-muted">Win rate</dt>
              <dd className="desk-nums text-right">{formatPct(dossier.winrate)}</dd>
              <dt className="text-muted">Trades</dt>
              <dd className="desk-nums text-right">{dossier.buyCount + dossier.sellCount}</dd>
              <dt className="text-muted">Created</dt>
              <dd className="desk-nums text-right">{dossier.createdTokenCount}</dd>
            </dl>

            <h3 className="mb-1.5 text-micro tracking-[0.16em] text-gold-dim">LAUNCHES</h3>
            {dossier.launches.length === 0 ? (
              <p className="mb-4 text-tiny text-faint">No launch history in this response.</p>
            ) : (
              <ul className="mb-4 space-y-1">
                {dossier.launches.map((l) => (
                  <li key={l.address}>
                    <button
                      type="button"
                      className="flex w-full justify-between text-tiny hover:text-gold"
                      onClick={() => selectToken(l.address)}
                    >
                      <span>{l.symbol}</span>
                      <span className="desk-nums text-muted">{formatUsd(l.marketCap)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mb-1.5 text-micro tracking-[0.16em] text-gold-dim">ACTIVITY</h3>
            {dossier.activity.length === 0 ? (
              <p className="text-tiny text-faint">No recent prints.</p>
            ) : (
              <ul className="space-y-1">
                {dossier.activity.map((a, i) => (
                  <li key={i} className="flex justify-between text-tiny">
                    <span className={a.side === "buy" ? "text-buy" : "text-sell"}>
                      {a.side.toUpperCase()} {a.symbol}
                    </span>
                    <span className="desk-nums text-muted">
                      {formatUsd(a.amount)} · {timeAgo(a.ts)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}