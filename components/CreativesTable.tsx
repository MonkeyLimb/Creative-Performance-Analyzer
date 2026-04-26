"use client";

import { useMemo, useState } from "react";
import { AdAccount, Creative, Thresholds, TierStatus } from "@/lib/types";
import { classify } from "@/lib/tiers";
import { buildAdsManagerUrl } from "@/lib/ads-manager-url";
import { fmtCurrency, fmtNumber, fmtPct, fmtRoas } from "@/lib/format";
import {
  CreativeMatchOverrides,
  CreativeRoas,
  RplOverrides,
  SCHOOL_REGISTRY,
  creativeMatchKey,
  deriveRoas,
} from "@/lib/schools";
import { StatusBadge } from "./StatusBadge";
import { DeliveryBadge } from "./DeliveryBadge";
import { QualityBadge } from "./QualityBadge";
import { DownloadCreativeButton } from "./DownloadCreativeButton";

type SortKey =
  | "status"
  | "adName"
  | "spend"
  | "results"
  | "cpl"
  | "ctr"
  | "rpl"
  | "revenue"
  | "roas";

export type DeliveryFilter = "all" | "active" | "inactive";

type Props = {
  creatives: Creative[];
  thresholds: Thresholds;
  filter: TierStatus | "all";
  deliveryFilter: DeliveryFilter;
  account: AdAccount;
  hasAdIds: boolean;
  metaToken: string;
  rplOverrides: RplOverrides;
  matchOverrides: CreativeMatchOverrides;
  onMatchOverridesChange: (o: CreativeMatchOverrides) => void;
};

const STATUS_RANK: Record<TierStatus, number> = {
  cut: 0,
  watch: 1,
  winner: 2,
};

const STATUS_COLOR: Record<TierStatus, string> = {
  winner: "#1D9E75",
  watch: "#EF9F27",
  cut: "#E24B4A",
};

export function CreativesTable({
  creatives,
  thresholds,
  filter,
  deliveryFilter,
  account,
  hasAdIds,
  metaToken,
  rplOverrides,
  matchOverrides,
  onMatchOverridesChange,
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "spend",
    dir: "desc",
  });
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const decorated = useMemo(
    () =>
      creatives.map((c) => ({
        creative: c,
        status: classify(c, thresholds),
        roas: deriveRoas(c, SCHOOL_REGISTRY, rplOverrides, matchOverrides),
        key: creativeMatchKey(c),
      })),
    [creatives, thresholds, rplOverrides, matchOverrides],
  );

  const setMatch = (
    key: string,
    school: string | null,
    program: string | null,
  ) => {
    const next = { ...matchOverrides, [key]: { school, program } };
    onMatchOverridesChange(next);
  };

  const clearMatch = (key: string) => {
    if (!(key in matchOverrides)) return;
    const next = { ...matchOverrides };
    delete next[key];
    onMatchOverridesChange(next);
  };

  const filtered = useMemo(() => {
    let d = decorated;
    if (deliveryFilter === "active") {
      d = d.filter((x) => x.creative.delivery === "active");
    } else if (deliveryFilter === "inactive") {
      d = d.filter((x) => x.creative.delivery !== "active");
    }
    if (filter !== "all") d = d.filter((x) => x.status === filter);
    return d;
  }, [decorated, filter, deliveryFilter]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = value(a.creative, a.status, a.roas, sort.key);
      const bv = value(b.creative, b.status, b.roas, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort]);

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

  const isClickable = !!account.actId;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface2 border-b border-border text-xs uppercase tracking-wider text-textDim">
            <tr>
              <SortableTH
                label="Creative"
                sortKey="adName"
                sort={sort}
                onClick={toggleSort}
                align="left"
              />
              <SortableTH
                label="Tier"
                sortKey="status"
                sort={sort}
                onClick={toggleSort}
                align="left"
              />
              <th className="px-3 py-2.5 text-left">Delivery</th>
              <SortableTH
                label="CPL"
                sortKey="cpl"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <SortableTH
                label="Leads"
                sortKey="results"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <SortableTH
                label="Spend"
                sortKey="spend"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <SortableTH
                label="RPL"
                sortKey="rpl"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <SortableTH
                label="Revenue"
                sortKey="revenue"
                sort={sort}
                onClick={toggleSort}
                align="right"
              />
              <SortableTH
                label="ROAS"
                sortKey="roas"
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
              <th className="px-3 py-2.5 text-right w-[1%] whitespace-nowrap">
                Asset
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ creative: c, status, roas, key }) => {
              const adsUrl = isClickable ? safeBuildAdsUrl(c, account) : null;
              const roasColor = roasTone(roas.roas);
              return (
              <tr
                key={key}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-3 py-2.5 max-w-sm">
                  <div
                    className="flex items-center gap-1.5 truncate"
                    title={c.adName}
                  >
                    {adsUrl ? (
                      <a
                        href={adsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.adName}
                      </a>
                    ) : (
                      <span className="truncate">{c.adName}</span>
                    )}
                    {adsUrl && (
                      <span className="text-textDim text-xs shrink-0">↗</span>
                    )}
                  </div>
                  <div className="mt-0.5">
                    <SchoolMatchEditor
                      match={roas.match}
                      source={roas.matchSource}
                      isEditing={editingKey === key}
                      onToggle={() =>
                        setEditingKey(editingKey === key ? null : key)
                      }
                      onSet={(school, program) => setMatch(key, school, program)}
                      onClear={() => clearMatch(key)}
                    />
                  </div>
                  {c.campaignName && (
                    <div
                      className="truncate text-xs text-textDim mt-0.5"
                      title={c.campaignName}
                    >
                      {c.campaignName}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={status} />
                </td>
                <td className="px-3 py-2.5">
                  <DeliveryBadge status={c.delivery} />
                </td>
                <td
                  className="px-3 py-2.5 text-right font-mono tabular-nums"
                  style={{ color: STATUS_COLOR[status] }}
                >
                  {c.cpl != null ? fmtCurrency(c.cpl) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {fmtNumber(c.results)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {fmtCurrency(c.spend)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-textDim">
                  {roas.rpl != null ? fmtCurrency(roas.rpl) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {fmtCurrency(roas.revenue)}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-mono tabular-nums"
                  style={roasColor ? { color: roasColor } : undefined}
                >
                  {fmtRoas(roas.roas)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-textDim">
                  {fmtPct(c.ctr)}
                </td>
                <td className="px-3 py-2.5">
                  <QualityBadge rank={c.quality} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <DownloadCreativeButton
                    adId={c.adId}
                    adName={c.adName}
                    token={metaToken}
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!hasAdIds && isClickable && (
        <div className="bg-surface2 border-t border-border px-4 py-2 text-xs text-textDim">
          No Ad ID column detected — name links filter by ad name only.
          Re-export with the Ad ID column for precise links.
        </div>
      )}
      {!isClickable && (
        <div className="bg-surface2 border-t border-border px-4 py-2 text-xs text-textDim">
          Add an Ad account ID in the sidebar to make ad names linkable.
        </div>
      )}
    </div>
  );
}

function safeBuildAdsUrl(c: Creative, account: AdAccount): string | null {
  try {
    return buildAdsManagerUrl({
      account,
      adNames: [c.adName],
      adIds: c.adId ? [c.adId] : undefined,
    });
  } catch {
    return null;
  }
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
  roas: CreativeRoas,
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
    case "ctr":
      return c.ctr;
    case "rpl":
      return roas.rpl;
    case "revenue":
      return roas.revenue;
    case "roas":
      return roas.roas;
  }
}

function roasTone(roas: number | null): string | undefined {
  if (roas == null) return undefined;
  if (roas >= 2) return "#1D9E75";
  if (roas >= 1) return "#EF9F27";
  return "#E24B4A";
}

function SchoolMatchEditor({
  match,
  source,
  isEditing,
  onToggle,
  onSet,
  onClear,
}: {
  match: { school: string; program: string | null } | null;
  source: CreativeRoas["matchSource"];
  isEditing: boolean;
  onToggle: () => void;
  onSet: (school: string | null, program: string | null) => void;
  onClear: () => void;
}) {
  const isManual = source !== "auto";

  // No match (auto or manually cleared) — show the school dropdown directly
  // so it's obvious users can pick one without first clicking a chip.
  if (!match) {
    return (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <select
          value={source === "manual-cleared" ? "__none__" : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") onClear();
            else if (v === "__none__") onSet(null, null);
            else onSet(v, null);
          }}
          className="bg-surface2 border border-border rounded px-1.5 py-0.5 text-[10px] text-textDim focus:outline-none focus:border-accent hover:border-accent/50 transition-colors"
          title="Pick a school for this creative"
        >
          <option value="" disabled>
            {source === "manual-cleared" ? "No match (manual)" : "Pick school…"}
          </option>
          <option value="">Auto-detect</option>
          <option value="__none__">No match</option>
          <optgroup label="Schools">
            {SCHOOL_REGISTRY.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </optgroup>
        </select>
        {isManual && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-textDim hover:text-cut underline-offset-2 hover:underline"
            title="Revert to auto-detect"
          >
            ↺ auto
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
          isManual
            ? "bg-accent/10 border-accent/40 text-text"
            : "bg-surface2 border-border text-textDim hover:border-accent/50"
        }`}
        title={
          isManual
            ? "Manually set — click to edit"
            : "Auto-detected — click to override"
        }
      >
        <span className="text-text font-medium">{match.school}</span>
        {match.program && (
          <>
            <span className="text-textDim/60">·</span>
            <span>{match.program}</span>
          </>
        )}
        <span className="text-textDim text-[9px] ml-0.5">
          {isEditing ? "▴" : "✎"}
        </span>
      </button>
      {isEditing && (
        <div className="flex flex-wrap items-center gap-1.5 bg-surface2 border border-border rounded-md p-1.5">
          <select
            value={match.school}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") onClear();
              else if (v === "__none__") onSet(null, null);
              else onSet(v, null);
            }}
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-accent"
          >
            <option value="">Auto-detect</option>
            <option value="__none__">No match</option>
            {SCHOOL_REGISTRY.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={match.program ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onSet(match.school, v === "" ? null : v);
            }}
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-accent max-w-[200px]"
          >
            <option value="">— program —</option>
            {(SCHOOL_REGISTRY.find((s) => s.name === match.school)?.programs ?? []).map(
              (p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ),
            )}
          </select>
          {isManual && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] text-textDim hover:text-cut underline-offset-2 hover:underline"
            >
              ↺ auto
            </button>
          )}
        </div>
      )}
    </div>
  );
}
