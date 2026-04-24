type Props = {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
};

export function MetricCard({ label, value, hint, accent }: Props) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-1.5">
      <div className="text-xs uppercase tracking-wider text-textDim">
        {label}
      </div>
      <div
        className="font-mono text-2xl tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-textDim">{hint}</div>}
    </div>
  );
}
