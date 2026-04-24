import { TierStatus } from "@/lib/types";

const META: Record<
  TierStatus,
  { label: string; color: string; bg: string }
> = {
  winner: { label: "Winner", color: "#1D9E75", bg: "rgba(29,158,117,0.15)" },
  watch: { label: "Watch", color: "#EF9F27", bg: "rgba(239,159,39,0.15)" },
  cut: { label: "Cut", color: "#E24B4A", bg: "rgba(226,75,74,0.15)" },
};

export function StatusBadge({ status }: { status: TierStatus }) {
  const m = META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-[0.04em]"
      style={{ color: m.color, backgroundColor: m.bg }}
    >
      {m.label}
    </span>
  );
}
