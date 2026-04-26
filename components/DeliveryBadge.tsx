import { DeliveryStatus } from "@/lib/types";

const LABELS: Record<DeliveryStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  paused: "Paused",
  completed: "Completed",
  rejected: "Rejected",
  in_review: "In review",
  unknown: "—",
};

const COLORS: Record<DeliveryStatus, string> = {
  active: "var(--color-winner)",
  inactive: "var(--color-textDim)",
  paused: "var(--color-watch)",
  completed: "var(--color-textDim)",
  rejected: "var(--color-cut)",
  in_review: "var(--color-accent)",
  unknown: "var(--color-textDim)",
};

export function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: COLORS[status] }}
      />
      <span className="text-textDim">{LABELS[status]}</span>
    </span>
  );
}
