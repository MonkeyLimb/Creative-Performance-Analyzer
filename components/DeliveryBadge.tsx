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
  active: "#1D9E75",
  inactive: "#8a8a92",
  paused: "#EF9F27",
  completed: "#8a8a92",
  rejected: "#E24B4A",
  in_review: "#6b5fff",
  unknown: "#8a8a92",
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
