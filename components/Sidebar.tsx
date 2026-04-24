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
    <aside className="w-[280px] shrink-0 border-r border-border bg-surface px-5 py-5 flex flex-col h-screen sticky top-0 overflow-y-auto">
      <div className="mb-4">
        <div className="text-sm font-semibold tracking-tight">
          Creative Performance
        </div>
        <div className="text-[11px] text-textDim mt-0.5">
          Meta Ads analyzer
        </div>
      </div>

      <Section title="Ad account">
        <Field label="Account ID">
          <TextInput
            placeholder="e.g. 2968881040018079"
            value={account.actId}
            onChange={(v) => onAccountChange({ ...account, actId: v })}
          />
          <Hint>
            Needed for clickable rows. Find in Ads Manager URL as{" "}
            <code className="font-mono">?act=</code>.
          </Hint>
        </Field>
        <Field label="Business ID (optional)">
          <TextInput
            placeholder="e.g. 480923986526914"
            value={account.businessId ?? ""}
            onChange={(v) =>
              onAccountChange({ ...account, businessId: v || undefined })
            }
          />
          <Hint>
            From URL as <code className="font-mono">business_id=</code>. Helps
            if you manage multiple businesses.
          </Hint>
        </Field>
      </Section>

      <Section title="Thresholds">
        <Field label="Winner CPL ≤">
          <NumberInput
            value={thresholds.winnerCpl}
            onChange={(v) =>
              onThresholdsChange({ ...thresholds, winnerCpl: v })
            }
            prefix="$"
            min={0}
          />
        </Field>
        <Field label="Cut CPL ≥">
          <NumberInput
            value={thresholds.cutCpl}
            onChange={(v) =>
              onThresholdsChange({ ...thresholds, cutCpl: v })
            }
            prefix="$"
            min={0}
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
            className="w-full bg-surface2 border border-border rounded-md px-2.5 py-2 text-[13px] font-mono focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="all">All</option>
          </select>
        </Field>
      </Section>

      <div className="mt-auto pt-4">
        {hasData && (
          <div className="text-[11px] text-textDim border-t border-border pt-3 leading-relaxed flex flex-col gap-1">
            <div>
              {creativesCount} creative{creativesCount === 1 ? "" : "s"} loaded
            </div>
            <div>
              Links:{" "}
              {!hasAccount ? (
                <span className="text-watch">add Account ID</span>
              ) : hasAdIds ? (
                <span className="text-winner">precise (Ad ID)</span>
              ) : (
                <span className="text-watch">name search</span>
              )}
            </div>
            <button
              className="text-left text-textDim hover:text-cut transition-colors mt-2"
              onClick={onClearData}
            >
              Clear loaded CSV
            </button>
          </div>
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
    <div className="mt-4 first:mt-0">
      <div className="text-[11px] uppercase tracking-[0.05em] text-textDim mb-3">
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
    <label className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.05em] text-textDim">
        {label}
      </span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-textDim leading-[1.4] mt-0.5">
      {children}
    </span>
  );
}

function NumberInput({
  value,
  onChange,
  prefix,
  min,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  min?: number;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-textDim text-[13px] font-mono pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={`w-full bg-surface2 border border-border rounded-md py-2 text-[13px] font-mono tabular-nums focus:outline-none focus:border-accent ${
          prefix ? "pl-6 pr-2.5" : "px-2.5"
        }`}
      />
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
      className="w-full bg-surface2 border border-border rounded-md px-2.5 py-2 text-[13px] font-mono focus:outline-none focus:border-accent"
    />
  );
}
