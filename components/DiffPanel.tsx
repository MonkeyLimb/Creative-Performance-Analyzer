"use client";

import { ReactNode } from "react";
import { computeDiff, DiffItem, NumericRow, diffKey } from "@/lib/diff";
import { fmtCurrency, fmtNumber, fmtPct, fmtRoas } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { DeliveryBadge } from "./DeliveryBadge";
import { QualityBadge } from "./QualityBadge";

type Props = {
  items: DiffItem[];
  onRemove: (key: string) => void;
  onClose: () => void;
  hiddenCount?: number;
};

const FORMATTERS: Record<string, (v: number | null) => string> = {
  spend: fmtCurrency,
  cpl: fmtCurrency,
  rpl: fmtCurrency,
  revenue: fmtCurrency,
  cpm: fmtCurrency,
  roas: fmtRoas,
  ctr: fmtPct,
  results: fmtNumber,
  impressions: fmtNumber,
  reach: fmtNumber,
  frequency: (v) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(2)),
};

export function DiffPanel({ items, onRemove, onClose, hiddenCount = 0 }: Props) {
  const diff = computeDiff(items);
  const cols = `minmax(140px, max-content) repeat(${items.length}, minmax(180px, 1fr))`;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface2">
        <div className="text-sm font-semibold">
          Compare {items.length} creative{items.length === 1 ? "" : "s"}
          {hiddenCount > 0 && (
            <span className="ml-2 text-xs font-normal text-textDim">
              · {hiddenCount} hidden by current filter
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-textDim hover:text-text text-xs uppercase tracking-wider"
          title="Close comparison"
        >
          ✕ Close
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-fit" style={{ gridTemplateColumns: cols }}>
          <div className="px-3 py-3 border-b border-border" />
          {items.map((it) => {
            const key = diffKey(it.creative);
            return (
              <div
                key={key}
                className="px-3 py-3 border-b border-l border-border flex items-start justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="font-medium text-sm truncate"
                    title={it.creative.adName}
                  >
                    {it.creative.adName}
                  </div>
                  {it.creative.campaignName && (
                    <div
                      className="text-xs text-textDim truncate"
                      title={it.creative.campaignName}
                    >
                      {it.creative.campaignName}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(key)}
                  className="text-textDim hover:text-cut text-xs shrink-0"
                  title="Remove from comparison"
                >
                  ✕
                </button>
              </div>
            );
          })}

          <Label>Tier</Label>
          {items.map((it, i) => (
            <Cell key={`tier-${i}`}>
              <StatusBadge status={it.status} />
            </Cell>
          ))}

          <Label>Delivery</Label>
          {items.map((it, i) => (
            <Cell key={`delivery-${i}`}>
              <DeliveryBadge status={it.creative.delivery} />
            </Cell>
          ))}

          <Label>School · Program</Label>
          {items.map((it, i) => (
            <Cell key={`school-${i}`}>
              {it.roas.match ? (
                <span className="text-sm">
                  <span className="font-medium">{it.roas.match.school}</span>
                  {it.roas.match.program && (
                    <span className="text-textDim"> · {it.roas.match.program}</span>
                  )}
                </span>
              ) : (
                <span className="text-textDim text-sm">—</span>
              )}
            </Cell>
          ))}

          <Label>Quality</Label>
          {items.map((it, i) => (
            <Cell key={`quality-${i}`}>
              <QualityBadge rank={it.creative.quality} />
            </Cell>
          ))}

          {diff.numeric.map((row) => (
            <NumericRowView key={row.key} row={row} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-2 text-xs uppercase tracking-wider text-textDim border-t border-border flex items-center">
      {children}
    </div>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-2 border-t border-l border-border flex items-center">
      {children}
    </div>
  );
}

function NumericRowView({ row }: { row: NumericRow }) {
  const formatter = FORMATTERS[row.key] ?? fmtNumber;
  return (
    <>
      <Label>{row.label}</Label>
      {row.values.map((v, i) => {
        const isBest = i === row.bestIndex;
        const isWorst = i === row.worstIndex;
        const color = isBest
          ? "var(--color-winner)"
          : isWorst
            ? "var(--color-cut)"
            : undefined;
        const weight = isBest || isWorst ? "font-semibold" : "";
        return (
          <div
            key={i}
            className={`px-3 py-2 border-t border-l border-border font-mono tabular-nums text-right text-sm ${weight}`}
            style={color ? { color } : undefined}
          >
            {formatter(v)}
          </div>
        );
      })}
    </>
  );
}
