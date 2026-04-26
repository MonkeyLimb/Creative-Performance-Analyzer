import { TierStatus } from "@/lib/types";

const META: Record<
  TierStatus,
  { label: string; color: string; bg: string }
> = {
  winner: {
    label: "Winner",
    color: "var(--color-winner)",
    bg: "color-mix(in srgb, var(--color-winner) 15%, transparent)",
  },
  watch: {
    label: "Watch",
    color: "var(--color-watch)",
    bg: "color-mix(in srgb, var(--color-watch) 15%, transparent)",
  },
  cut: {
    label: "Cut",
    color: "var(--color-cut)",
    bg: "color-mix(in srgb, var(--color-cut) 15%, transparent)",
  },
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
