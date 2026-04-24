import { TierStatus } from "@/lib/types";

const META: Record<
  TierStatus,
  { label: string; color: string; bg: string }
> = {
  winner: { label: "Winner", color: "#1D9E75", bg: "rgba(29,158,117,0.12)" },
  watch: { label: "Watch", color: "#EF9F27", bg: "rgba(239,159,39,0.12)" },
  cut: { label: "Cut", color: "#E24B4A", bg: "rgba(226,75,74,0.12)" },
  new: { label: "New", color: "#8a8a92", bg: "rgba(138,138,146,0.12)" },
};

export function StatusBadge({ status }: { status: TierStatus }) {
  const m = META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: m.color, backgroundColor: m.bg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: m.color }}
      />
      {m.label}
    </span>
  );
}
