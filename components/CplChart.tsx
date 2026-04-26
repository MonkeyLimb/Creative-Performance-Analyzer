"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Creative, Thresholds } from "@/lib/types";
import { classify } from "@/lib/tiers";
import {
  CreativeMatchOverrides,
  RplOverrides,
  SCHOOL_REGISTRY,
  deriveRoas,
} from "@/lib/schools";

const STATUS_COLOR: Record<string, string> = {
  winner: "#1D9E75",
  watch: "#EF9F27",
  cut: "#E24B4A",
};

export type TopN = 5 | 10 | 20 | "all";

type Props = {
  creatives: Creative[];
  thresholds: Thresholds;
  rplOverrides: RplOverrides;
  matchOverrides: CreativeMatchOverrides;
  topN?: TopN;
};

export function CplChart({
  creatives,
  thresholds,
  rplOverrides,
  matchOverrides,
  topN = 10,
}: Props) {
  const sorted = creatives
    .filter((c) => c.cpl != null && (c.cpl as number) > 0)
    .sort((a, b) => (a.cpl as number) - (b.cpl as number));

  const limited = topN === "all" ? sorted : sorted.slice(0, topN);
  const prefix = commonPrefix(limited.map((c) => c.adName));

  const data = limited.map((c) => {
    const r = deriveRoas(c, SCHOOL_REGISTRY, rplOverrides, matchOverrides);
    return {
      name: smartTruncate(c.adName, prefix, 32),
      fullName: c.adName,
      cpl: Number((c.cpl as number).toFixed(2)),
      status: classify(c, thresholds, r.roas),
    };
  });

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-sm text-textDim">
        No CPL data yet
      </div>
    );
  }

  const height = Math.max(280, data.length * 32);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
          barCategoryGap={6}
        >
          <CartesianGrid
            stroke="#2a2a2e"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, "dataMax"]}
            tick={{ fill: "#8a8a92", fontSize: 10 }}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#8a8a92", fontSize: 10 }}
            width={200}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(107, 95, 255, 0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0].payload as {
                fullName: string;
                cpl: number;
                status: string;
              };
              return (
                <div className="bg-surface2 border border-border rounded px-2.5 py-1.5 text-xs max-w-xs">
                  <div className="text-text break-all">{p.fullName}</div>
                  <div className="font-mono tabular-nums text-textDim mt-0.5">
                    CPL ${p.cpl.toFixed(2)}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="cpl" radius={[0, 3, 3, 0]} minPointSize={2}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={STATUS_COLOR[entry.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function commonPrefix(strings: string[]): string {
  if (strings.length < 2) return "";
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (prefix.length > 0 && !strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
    if (!prefix) return "";
  }
  return prefix;
}

function smartTruncate(s: string, prefix: string, max: number): string {
  if (prefix.length > 8 && s.length > max) {
    const suffix = s.slice(prefix.length);
    const budget = max - 1;
    if (suffix.length <= budget) return "…" + suffix;
    return "…" + suffix.slice(-budget);
  }
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
