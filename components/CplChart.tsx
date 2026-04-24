"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Creative, Thresholds } from "@/lib/types";
import { classify } from "@/lib/tiers";

const STATUS_COLOR: Record<string, string> = {
  winner: "#1D9E75",
  watch: "#EF9F27",
  cut: "#E24B4A",
  new: "#3a3a3f",
};

type Props = {
  creatives: Creative[];
  thresholds: Thresholds;
};

export function CplChart({ creatives, thresholds }: Props) {
  const data = creatives
    .filter((c) => c.cpl != null)
    .map((c) => ({
      name: truncate(c.adName, 28),
      cpl: c.cpl as number,
      status: classify(c, thresholds),
    }))
    .sort((a, b) => a.cpl - b.cpl)
    .slice(0, 30);

  if (data.length === 0) {
    return <EmptyState label="No CPL data yet" />;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#2a2a2e" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#8a8a92", fontSize: 10 }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fill: "#8a8a92", fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#161618",
              border: "1px solid #2a2a2e",
              borderRadius: 6,
              color: "#e8e8ea",
              fontSize: 12,
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "CPL"]}
          />
          <ReferenceLine
            y={thresholds.targetCpl}
            stroke="#6b5fff"
            strokeDasharray="4 4"
            label={{
              value: `Target $${thresholds.targetCpl}`,
              fill: "#6b5fff",
              fontSize: 10,
              position: "right",
            }}
          />
          <Bar dataKey="cpl" radius={[2, 2, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={STATUS_COLOR[entry.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-80 flex items-center justify-center text-sm text-textDim">
      {label}
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
