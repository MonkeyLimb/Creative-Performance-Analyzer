"use client";

import { useMemo, useState } from "react";
import { Creative, Thresholds, TierStatus } from "@/lib/types";
import { classify } from "@/lib/tiers";
import { fmtCurrency, fmtNumber, fmtPct } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { DeliveryBadge } from "./DeliveryBadge";
import { QualityBadge } from "./QualityBadge";

type SortKey =
  | "status"
  | "adName"
  | "spend"
  | "results"
  | "cpl"
  | "impressions"
  | "ctr";

type Props = {
  creatives: Creative[];
  thresholds: Thresholds;
  filter: TierStatus | "all";
  selected: Set<string>;
  onToggleSelect: (key: string) => void;
  onToggleAll: (keys: string[]) => void;
  hasAdIds: boolean;
};

const STATUS_RANK: Record<TierStatus, number> = {
  cut: 0,
  watch: 1,
  winner: 2,
  new: 3,
};

export function CreativesTable({
  creatives,
  thresholds,
  filter,
  selected,
  onToggleSelect,
  onToggleAll,
  hasAdIds,
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "spend",
    dir: "desc",
  });

  const decorated = useMemo(
    () =>
      creatives.map((c) => ({
        creative: c,
        status: classify(c, thresholds),
        key: c.adId || c.adName,
      })),
    [creatives, thresholds],
  );

  const filtered = useMemo(
    () =>
      filter === "all"
        ? decorated
        : decorated.filter((d) => d.status === filter),
    [decorated, filter],
  );

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = value(a.creative, a.status, sort.key);
      const bv = value(b.creative, b.status, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort]);

  const allKeys = sorted.map((d) => d.key);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  };

  if (sorted.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-10 text-center text-sm text-textDim">
        No creatives match this filter.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface2 border-b border-border text-xs uppercase tracking-wider text-textDim">
            <tr>
              <th className="w-10 px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={allSelected}
                  onChange={() => onToggleAll(allKeys)}
                  aria-label="Select all visible"
                />
              </th>
              <SortableTH
                label="Status"
                sortKey="status"
                sort={sort}
                onClick={toggleSort}
                align="left"
              />
              <SortableTH
                label="Ad"
                sortKey="adName"
                sort={sort}
                onClick={toggleSort}
                align="left"
              />
              <SortableTH
                label="Spend"
                sortKey="spend"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <SortableTH
                label="Results"
                sortKey="results"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <SortableTH
                label="CPL"
                sortKey="cpl"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <SortableTH
                label="Impressions"
                sortKey="impressions"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <SortableTH
                label="CTR"
                sortKey="ctr"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <th className="px-3 py-2.5 text-left">Quality</th>
              <th className="px-3 py-2.5 text-left">Delivery</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ creative: c, status, key }) => (
              <tr
                key={key}
                className="border-b border-border last:border-b-0 hover:bg-surface2/60 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={selected.has(key)}
                    onChange={() => onToggleSelect(key)}
                    aria-label={`Select ${c.adName}`}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={status} />
                </td>
                <td className="px-3 py-2.5 max-w-sm">
                  <div className="truncate" title={c.adName}>
                    {c.adName}
                  </div>
                  {c.campaignName && (
                    <div
                      className="truncate text-xs text-textDim"
                      title={c.campaignName}
                    >
                      {c.campaignName}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {fmtCurrency(c.spend)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {fmtNumber(c.results)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {fmtCurrency(c.cpl)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-textDim">
                  {fmtNumber(c.impressions)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-textDim">
                  {fmtPct(c.ctr)}
                </td>
                <td className="px-3 py-2.5">
                  <QualityBadge rank={c.quality} />
                </td>
                <td className="px-3 py-2.5">
                  <DeliveryBadge status={c.delivery} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hasAdIds && (
        <div className="bg-surface2 border-t border-border px-4 py-2 text-xs text-textDim">
          No Ad ID column detected — the open-in-Ads-Manager link will filter by
          ad name only.
        </div>
      )}
    </div>
  );
}

function SortableTH({
  label,
  sortKey,
  sort,
  onClick,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onClick: (k: SortKey) => void;
  align: "left" | "right";
}) {
  const isActive = sort.key === sortKey;
  const arrow = isActive ? (sort.dir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      className={`px-3 py-2.5 cursor-pointer select-none hover:text-text ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => onClick(sortKey)}
    >
      {label} {arrow && <span className="text-accent">{arrow}</span>}
    </th>
  );
}

function value(
  c: Creative,
  status: TierStatus,
  key: SortKey,
): string | number | null {
  switch (key) {
    case "status":
      return STATUS_RANK[status];
    case "adName":
      return c.adName.toLowerCase();
    case "spend":
      return c.spend;
    case "results":
      return c.results;
    case "cpl":
      return c.cpl;
    case "impressions":
      return c.impressions;
    case "ctr":
      return c.ctr;
  }
}
