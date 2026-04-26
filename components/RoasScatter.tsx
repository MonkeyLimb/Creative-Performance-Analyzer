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
import { Creative } from "@/lib/types";
import {
  CreativeMatchOverrides,
  RplOverrides,
  SCHOOL_REGISTRY,
  deriveRoas,
} from "@/lib/schools";

type Props = {
  creatives: Creative[];
  rplOverrides: RplOverrides;
  matchOverrides: CreativeMatchOverrides;
};

type Point = {
  x: number;
  y: number;
  name: string;
  school: string;
  revenue: number;
};

function roasColor(roas: number): string {
  if (roas >= 2) return "#1D9E75";
  if (roas >= 1) return "#EF9F27";
  return "#E24B4A";
}

export function RoasScatter({
  creatives,
  rplOverrides,
  matchOverrides,
}: Props) {
  const groups: { winner: Point[]; watch: Point[]; cut: Point[] } = {
    winner: [],
    watch: [],
    cut: [],
  };

  for (const c of creatives) {
    if (c.spend <= 0) continue;
    const r = deriveRoas(c, SCHOOL_REGISTRY, rplOverrides, matchOverrides);
    if (r.roas == null) continue;
    const point: Point = {
      x: c.spend,
      y: Number((r.roas as number).toFixed(2)),
      name: c.adName,
      school: r.match?.school ?? "—",
      revenue: r.revenue ?? 0,
    };
    if (r.roas >= 2) groups.winner.push(point);
    else if (r.roas >= 1) groups.watch.push(point);
    else groups.cut.push(point);
  }

  const total = groups.winner.length + groups.watch.length + groups.cut.length;
  if (total === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-sm text-textDim text-center px-6">
        Add school keywords to ad names to see ROAS scatter.
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
            name="ROAS"
            tick={{ fill: "var(--color-textDim)", fontSize: 10 }}
            tickFormatter={(v) => `${v}×`}
            width={48}
            label={{
              value: "ROAS",
              angle: -90,
              position: "insideLeft",
              offset: 8,
              fill: "var(--color-textDim)",
              fontSize: 11,
            }}
          />
          <ZAxis range={[60, 60]} />
          <ReferenceLine
            y={1}
            stroke="var(--color-textDim)"
            strokeDasharray="2 4"
            label={{
              value: "break-even",
              position: "insideTopRight",
              offset: 6,
              fill: "var(--color-textDim)",
              fontSize: 9,
            }}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-grid)", strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="chart-tooltip rounded px-2.5 py-1.5 text-xs max-w-[260px]">
                  <div className="break-all mb-0.5">{p.name}</div>
                  <div className="text-[10px] text-textDim mt-0.5">
                    {p.school}
                  </div>
                  <div className="font-mono tabular-nums text-textDim mt-0.5">
                    Spend ${p.x.toFixed(2)} · ROAS {p.y.toFixed(2)}× · $
                    {p.revenue.toFixed(0)} rev
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={groups.cut} fill={roasColor(0)} />
          <Scatter data={groups.watch} fill={roasColor(1)} />
          <Scatter data={groups.winner} fill={roasColor(2)} />
        </RScatter>
      </ResponsiveContainer>
    </div>
  );
}
