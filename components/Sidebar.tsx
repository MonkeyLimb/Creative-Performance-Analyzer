"use client";

import { AdAccount, Thresholds } from "@/lib/types";
import { TopN } from "./CplChart";

type Props = {
  thresholds: Thresholds;
  onThresholdsChange: (t: Thresholds) => void;
  account: AdAccount;
  onAccountChange: (a: AdAccount) => void;
  topN: TopN;
  onTopNChange: (t: TopN) => void;
  onClearData: () => void;
  hasData: boolean;
  hasAdIds: boolean;
  creativesCount: number;
};

export function Sidebar({
  thresholds,
  onThresholdsChange,
  account,
  onAccountChange,
  topN,
  onTopNChange,
  onClearData,
  hasData,
  hasAdIds,
  creativesCount,
}: Props) {
  const hasAccount = !!account.actId.trim();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface p-5 flex flex-col gap-6 h-screen sticky top-0 overflow-y-auto">
      <div>
        <div className="text-sm font-semibold tracking-tight">
          Creative Performance
        </div>
        <div className="text-xs text-textDim mt-0.5">Meta Ads analyzer</div>
      </div>

      <Section title="Ad account">
        <Field label="Account ID">
          <TextInput
            placeholder="e.g. 123456789"
            value={account.actId}
            onChange={(v) => onAccountChange({ ...account, actId: v })}
          />
          <Hint>
            Needed for clickable rows. Find in Ads Manager URL as{" "}
            <code className="font-mono text-textDim">?act=</code>.
          </Hint>
        </Field>
        <Field label="Business ID (optional)">
          <TextInput
            placeholder="—"
            value={account.businessId ?? ""}
            onChange={(v) =>
              onAccountChange({ ...account, businessId: v || undefined })
            }
          />
        </Field>
      </Section>

      <Section title="Thresholds">
        <Field label="Target CPL">
          <NumberInput
            value={thresholds.targetCpl}
            onChange={(v) => onThresholdsChange({ ...thresholds, targetCpl: v })}
            prefix="$"
          />
        </Field>
        <Field label="Winner ratio">
          <NumberInput
            value={thresholds.winnerMultiplier}
            step={0.05}
            onChange={(v) =>
              onThresholdsChange({ ...thresholds, winnerMultiplier: v })
            }
            suffix="×"
          />
        </Field>
        <Field label="Cut ratio">
          <NumberInput
            value={thresholds.cutMultiplier}
            step={0.05}
            onChange={(v) =>
              onThresholdsChange({ ...thresholds, cutMultiplier: v })
            }
            suffix="×"
          />
        </Field>
        <Field label="Min spend">
          <NumberInput
            value={thresholds.minSpend}
            onChange={(v) => onThresholdsChange({ ...thresholds, minSpend: v })}
            prefix="$"
          />
        </Field>
      </Section>

      <Section title="Chart">
        <Field label="Top N in CPL chart">
          <select
            value={String(topN)}
            onChange={(e) => {
              const v = e.target.value;
              onTopNChange(v === "all" ? "all" : (Number(v) as TopN));
            }}
            className="w-full bg-surface2 border border-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="all">All</option>
          </select>
        </Field>
      </Section>

      <div className="mt-auto flex flex-col gap-3">
        {hasData && (
          <div className="text-xs text-textDim border-t border-border pt-3 leading-relaxed">
            <div>
              {creativesCount} creative{creativesCount === 1 ? "" : "s"} loaded
            </div>
            <div>
              Links:{" "}
              {!hasAccount ? (
                <span className="text-watch">add account ID</span>
              ) : hasAdIds ? (
                <span className="text-winner">precise (Ad ID)</span>
              ) : (
                <span className="text-watch">name search</span>
              )}
            </div>
          </div>
        )}
        {hasData && (
          <button
            className="w-full text-xs text-textDim hover:text-cut transition-colors py-2"
            onClick={onClearData}
          >
            Clear loaded CSV
          </button>
        )}
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-textDim mb-3">
        {title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-textDim">{label}</span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-textDim leading-snug">{children}</span>
  );
}

function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-textDim text-sm font-mono">
          {prefix}
        </span>
      )}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={`w-full bg-surface2 border border-border rounded px-2 py-1.5 text-sm font-mono tabular-nums focus:outline-none focus:border-accent ${
          prefix ? "pl-6" : ""
        } ${suffix ? "pr-6" : ""}`}
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-textDim text-sm font-mono">
          {suffix}
        </span>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-surface2 border border-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-accent"
    />
  );
}
