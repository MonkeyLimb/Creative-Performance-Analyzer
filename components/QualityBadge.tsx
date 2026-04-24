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
  above_average: "#1D9E75",
  average: "#8a8a92",
  below_average_35: "#EF9F27",
  below_average_20: "#EF9F27",
  below_average_10: "#E24B4A",
  unknown: "#2a2a2e",
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
