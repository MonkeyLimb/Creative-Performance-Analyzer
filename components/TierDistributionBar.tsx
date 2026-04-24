"use client";

import { TierStatus } from "@/lib/types";
import { TierSummary } from "@/lib/tiers";
import { fmtCurrency } from "@/lib/format";

const TIER_META: Record<TierStatus, { label: string; color: string }> = {
  winner: { label: "Winner", color: "#1D9E75" },
  watch: { label: "Watch", color: "#EF9F27" },
  cut: { label: "Cut", color: "#E24B4A" },
  new: { label: "New", color: "#8a8a92" },
};

const ORDER: TierStatus[] = ["winner", "watch", "cut", "new"];

type Props = {
  summary: TierSummary[];
  activeFilter: TierStatus | "all";
  onFilterChange: (f: TierStatus | "all") => void;
  className?: string;
};

export function TierDistributionBar({
  summary,
  activeFilter,
  onFilterChange,
  className,
}: Props) {
  const ordered = ORDER.map((status) =>
    summary.find((s) => s.status === status),
  ).filter((s): s is TierSummary => !!s && s.count > 0);

  const total = ordered.reduce((s, t) => s + t.count, 0);

  if (total === 0) {
    return (
      <div
        className={`bg-surface border border-border rounded-lg p-4 flex items-center justify-center text-sm text-textDim ${className ?? ""}`}
      >
        No creatives to classify.
      </div>
    );
  }

  return (
    <div
      className={`bg-surface border border-border rounded-lg p-4 flex flex-col gap-3 ${className ?? ""}`}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wider text-textDim">
          Tier distribution
        </div>
        <div className="text-xs text-textDim">
          {total} creative{total === 1 ? "" : "s"}
          {activeFilter !== "all" && (
            <>
              {" · "}
              <button
                onClick={() => onFilterChange("all")}
                className="text-accent hover:underline"
              >
                clear filter
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className="flex w-full h-9 rounded overflow-hidden gap-0.5 bg-bg"
        role="group"
        aria-label="Filter by tier"
      >
        {ordered.map((tier) => {
          const pct = (tier.count / total) * 100;
          const meta = TIER_META[tier.status];
          const isActive = activeFilter === tier.status;
          const dim = activeFilter !== "all" && !isActive;
          return (
            <button
              key={tier.status}
              onClick={() =>
                onFilterChange(isActive ? "all" : tier.status)
              }
              className="group relative flex items-center justify-center text-[11px] font-semibold transition-opacity"
              style={{
                width: `${pct}%`,
                background: meta.color,
                opacity: dim ? 0.3 : 1,
                color: "#0e0e0f",
              }}
              title={`${meta.label} · ${tier.count} · ${fmtCurrency(tier.spend)} spend · ${fmtCurrency(tier.cpl)} CPL`}
              aria-pressed={isActive}
              aria-label={`${meta.label}: ${tier.count} creatives`}
            >
              {pct > 6 ? tier.count : ""}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {ordered.map((tier) => {
          const meta = TIER_META[tier.status];
          const isActive = activeFilter === tier.status;
          return (
            <button
              key={tier.status}
              onClick={() =>
                onFilterChange(isActive ? "all" : tier.status)
              }
              className={`flex items-center gap-1.5 transition-colors ${
                isActive ? "text-text" : "text-textDim hover:text-text"
              }`}
              aria-pressed={isActive}
            >
              <span
                className="w-2 h-2 rounded-sm"
                style={{ background: meta.color }}
              />
              <span>{meta.label}</span>
              <span className="font-mono tabular-nums">{tier.count}</span>
              <span className="text-textDim">·</span>
              <span className="font-mono tabular-nums">
                {fmtCurrency(tier.cpl)}
              </span>
              <span className="text-textDim">CPL</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
