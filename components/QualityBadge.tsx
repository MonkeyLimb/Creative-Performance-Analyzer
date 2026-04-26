import { QualityRanking } from "@/lib/types";

const LABELS: Record<QualityRanking, string> = {
  above_average: "Above avg",
  average: "Average",
  below_average_35: "Bottom 35%",
  below_average_20: "Bottom 20%",
  below_average_10: "Bottom 10%",
  unknown: "—",
};

const COLORS: Record<QualityRanking, string> = {
  above_average: "var(--color-winner)",
  average: "var(--color-textDim)",
  below_average_35: "var(--color-watch)",
  below_average_20: "var(--color-watch)",
  below_average_10: "var(--color-cut)",
  unknown: "var(--color-border)",
};

export function QualityBadge({ rank }: { rank: QualityRanking }) {
  return (
    <span
      className="font-mono text-xs"
      style={{ color: COLORS[rank] }}
      title={LABELS[rank]}
    >
      {LABELS[rank]}
    </span>
  );
}
