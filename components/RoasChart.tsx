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
import { Creative } from "@/lib/types";
import {
  CreativeMatchOverrides,
  RplOverrides,
  SCHOOL_REGISTRY,
  deriveRoas,
} from "@/lib/schools";
import { TopN } from "./CplChart";

type Props = {
  creatives: Creative[];
  rplOverrides: RplOverrides;
  matchOverrides: CreativeMatchOverrides;
  topN?: TopN;
};

// Same color scale used in the table — green ≥ 2x, amber ≥ 1x, red < 1x.
function roasColor(roas: number): string {
  if (roas >= 2) return "#1D9E75";
  if (roas >= 1) return "#EF9F27";
  return "#E24B4A";
}

export function RoasChart({
  creatives,
  rplOverrides,
  matchOverrides,
  topN = 10,
}: Props) {
  const enriched = creatives
    .map((c) => ({
      creative: c,
      ...deriveRoas(c, SCHOOL_REGISTRY, rplOverrides, matchOverrides),
    }))
    .filter((x) => x.roas != null && (x.roas as number) > 0)
    .sort((a, b) => (b.roas as number) - (a.roas as number));

  const limited = topN === "all" ? enriched : enriched.slice(0, topN);

  const data = limited.map((x) => ({
    name: smartTruncate(x.creative.adName, 32),
    fullName: x.creative.adName,
    school: x.match?.school ?? "—",
    program: x.match?.program ?? null,
    roas: Number((x.roas as number).toFixed(2)),
    revenue: x.revenue ?? 0,
    spend: x.creative.spend,
  }));

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-sm text-textDim text-center px-6">
        Add an Ad name with a school keyword (UMA, CCI, FSU, MedCerts, Herzing, SNHU, AIU, CTU) to see ROAS.
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
          margin={{ top: 22, right: 32, left: 0, bottom: 8 }}
          barCategoryGap={6}
        >
          <CartesianGrid
            stroke="var(--color-grid)"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, "dataMax"]}
            tick={{ fill: "var(--color-textDim)", fontSize: 10 }}
            tickFormatter={(v) => `${v}×`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "var(--color-textDim)", fontSize: 10 }}
            width={200}
            interval={0}
          />
          <ReferenceLine
            x={1}
            stroke="var(--color-textDim)"
            strokeDasharray="2 4"
            label={{
              value: "break-even",
              position: "insideTop",
              offset: 8,
              fill: "var(--color-textDim)",
              fontSize: 9,
            }}
          />
          <Tooltip
            cursor={{ fill: "rgba(107, 95, 255, 0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0].payload as {
                fullName: string;
                school: string;
                program: string | null;
                roas: number;
                revenue: number;
                spend: number;
              };
              return (
                <div className="chart-tooltip rounded px-2.5 py-1.5 text-xs max-w-xs">
                  <div className="break-all">{p.fullName}</div>
                  <div className="text-[10px] text-textDim mt-0.5">
                    {p.school}
                    {p.program ? ` · ${p.program}` : ""}
                  </div>
                  <div className="font-mono tabular-nums text-textDim mt-0.5">
                    ROAS {p.roas.toFixed(2)}× · ${p.revenue.toFixed(0)} rev / $
                    {p.spend.toFixed(0)} spend
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="roas" radius={[0, 3, 3, 0]} minPointSize={2}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={roasColor(entry.roas)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function smartTruncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
