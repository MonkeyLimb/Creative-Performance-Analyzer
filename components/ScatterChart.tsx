"use client";

import {
  CartesianGrid,
  ReferenceLine,
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
  new: "#3a3a3f",
};

type Props = {
  creatives: Creative[];
  thresholds: Thresholds;
};

export function SpendCplScatter({ creatives, thresholds }: Props) {
  const byStatus: Record<TierStatus, Array<{ x: number; y: number; name: string }>> = {
    winner: [],
    watch: [],
    cut: [],
    new: [],
  };

  for (const c of creatives) {
    if (c.cpl == null || c.spend <= 0) continue;
    const status = classify(c, thresholds);
    byStatus[status].push({ x: c.spend, y: c.cpl, name: c.adName });
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
        <RScatter margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#2a2a2e" />
          <XAxis
            type="number"
            dataKey="x"
            name="Spend"
            tick={{ fill: "#8a8a92", fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="CPL"
            tick={{ fill: "#8a8a92", fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            cursor={{ stroke: "#2a2a2e" }}
            contentStyle={{
              backgroundColor: "#161618",
              border: "1px solid #2a2a2e",
              borderRadius: 6,
              color: "#e8e8ea",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              `$${value.toFixed(2)}`,
              name,
            ]}
            labelFormatter={() => ""}
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const p = payload[0].payload as {
                name: string;
                x: number;
                y: number;
              };
              return (
                <div className="bg-surface border border-border rounded px-2 py-1.5 text-xs">
                  <div className="text-text">{p.name}</div>
                  <div className="font-mono text-textDim">
                    Spend ${p.x.toFixed(2)} · CPL ${p.y.toFixed(2)}
                  </div>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={thresholds.targetCpl}
            stroke="#6b5fff"
            strokeDasharray="4 4"
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
