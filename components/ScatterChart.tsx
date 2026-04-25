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

const STATUS_COLOR: Record<TierStatus, string> = {
  winner: "#1D9E75",
  watch: "#EF9F27",
  cut: "#E24B4A",
};

type Props = {
  creatives: Creative[];
  thresholds: Thresholds;
};

type Point = {
  x: number;
  y: number;
  name: string;
  cpl: number | null;
};

export function SpendVsLeadsScatter({ creatives, thresholds }: Props) {
  const byStatus: Record<TierStatus, Point[]> = {
    winner: [],
    watch: [],
    cut: [],
  };

  for (const c of creatives) {
    if (c.spend <= 0 && c.results <= 0) continue;
    const status = classify(c, thresholds);
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
        <RScatter margin={{ top: 8, right: 24, left: 0, bottom: 24 }}>
          <CartesianGrid stroke="#2a2a2e" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="Spend"
            tick={{ fill: "#8a8a92", fontSize: 10 }}
            tickFormatter={(v) => `$${v}`}
            label={{
              value: "Spend ($)",
              position: "insideBottom",
              offset: -10,
              fill: "#8a8a92",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Leads"
            tick={{ fill: "#8a8a92", fontSize: 10 }}
            label={{
              value: "Leads",
              angle: -90,
              position: "insideLeft",
              offset: 16,
              fill: "#8a8a92",
              fontSize: 11,
            }}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            cursor={{ stroke: "#2a2a2e", strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="bg-surface2 border border-border rounded px-2.5 py-1.5 text-xs max-w-[260px]">
                  <div className="text-text break-all mb-0.5">{p.name}</div>
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
