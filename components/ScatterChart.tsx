"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RScatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Creative, Thresholds, TierStatus } from "@/lib/types";
import { classify } from "@/lib/tiers";
import {
  CreativeMatchOverrides,
  RplOverrides,
  SCHOOL_REGISTRY,
  deriveRoas,
} from "@/lib/schools";

const STATUS_COLOR: Record<TierStatus, string> = {
  winner: "#1D9E75",
  watch: "#EF9F27",
  cut: "#E24B4A",
};

type Props = {
  creatives: Creative[];
  thresholds: Thresholds;
  rplOverrides: RplOverrides;
  matchOverrides: CreativeMatchOverrides;
};

type Point = {
  x: number;
  y: number;
  name: string;
  cpl: number | null;
};

export function SpendVsLeadsScatter({
  creatives,
  thresholds,
  rplOverrides,
  matchOverrides,
}: Props) {
  const byStatus: Record<TierStatus, Point[]> = {
    winner: [],
    watch: [],
    cut: [],
  };

  for (const c of creatives) {
    if (c.spend <= 0 && c.results <= 0) continue;
    const r = deriveRoas(c, SCHOOL_REGISTRY, rplOverrides, matchOverrides);
    const status = classify(c, thresholds, r.roas);
    byStatus[status].push({
      x: c.spend,
      y: c.results,
      name: c.adName,
      cpl: c.cpl,
    });
  }

  const total = Object.values(byStatus).reduce((s, arr) => s + arr.length, 0);
  if (total === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-sm text-textDim">
        No scatter data yet
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RScatter margin={{ top: 12, right: 32, left: 16, bottom: 32 }}>
          <CartesianGrid stroke="var(--color-grid)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="Spend"
            tick={{ fill: "var(--color-textDim)", fontSize: 10 }}
            tickFormatter={(v) => `$${v}`}
            label={{
              value: "Spend ($)",
              position: "insideBottom",
              offset: -14,
              fill: "var(--color-textDim)",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Leads"
            tick={{ fill: "var(--color-textDim)", fontSize: 10 }}
            width={48}
            label={{
              value: "Leads",
              angle: -90,
              position: "insideLeft",
              offset: 8,
              fill: "var(--color-textDim)",
              fontSize: 11,
            }}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            cursor={{ stroke: "var(--color-grid)", strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="chart-tooltip rounded px-2.5 py-1.5 text-xs max-w-[260px]">
                  <div className="break-all mb-0.5">{p.name}</div>
                  <div className="font-mono tabular-nums text-textDim">
                    Spend ${p.x.toFixed(2)} · Leads {p.y}
                    {p.cpl != null && ` · CPL $${p.cpl.toFixed(2)}`}
                  </div>
                </div>
              );
            }}
          />
          {(Object.keys(byStatus) as TierStatus[]).map((status) => (
            <Scatter
              key={status}
              data={byStatus[status]}
              fill={STATUS_COLOR[status]}
            />
          ))}
        </RScatter>
      </ResponsiveContainer>
    </div>
  );
}
