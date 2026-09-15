import type { AgentCard } from "@/lib/agent/types.ts";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AgentFocus() {
  const focus = useDesk((s) => s.agent.focus);
  const selectToken = useDesk((s) => s.selectToken);

  return (
    <div className="shrink-0 border-b border-line bg-surface">
      <div className="flex h-7 items-center justify-between px-2">
        <span className="text-micro tracking-[0.16em] text-gold-dim">AGENT</span>
        <span className="text-micro text-faint">{focus.length ? `${focus.length} focus` : "listening"}</span>
      </div>
      {focus.length === 0 ? (
        <p className="px-2 pb-2 text-micro leading-snug text-muted">Watching Pre / Post. Quiet until the picture changes.</p>
      ) : (
        <ul className="px-1 pb-1">
          {focus.map((card) => (
            <li key={card.address}>
              <button
                type="button"
                onClick={() => selectToken(card.address)}
                className="flex w-full items-baseline gap-2 rounded-sm px-1.5 py-1 text-left hover:bg-hover"
              >
                <Kind kind={card.kind} />
                <span className="w-12 shrink-0 text-tiny font-medium text-fg">{card.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-micro text-muted">{card.reason}</span>
                {card.stage === "pre_mig" ? (
                  <span className="desk-nums text-micro text-gold">{Math.round(card.progress * 100)}%</span>
                ) : (
                  <span className="text-micro uppercase tracking-[0.08em] text-faint">
                    {card.stage === "migrated" ? "POST" : card.stage === "fresh" ? "NEW" : ""}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kind({ kind }: { kind: AgentCard["kind"] }) {
  const label = kind === "alert" ? "ALERT" : kind === "drop" ? "DROP" : "WATCH";
  const tone = kind === "alert" ? "text-gold" : kind === "drop" ? "text-sell" : "text-steel";
  return <span className={cn("w-10 shrink-0 text-micro tracking-[0.08em]", tone)}>{label}</span>;
}
