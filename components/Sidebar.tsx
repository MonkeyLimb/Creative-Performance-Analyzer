"use client";

import { ChangeEvent, useRef } from "react";
import { AdAccount, Thresholds } from "@/lib/types";
import { TopN } from "./CplChart";

type Props = {
  thresholds: Thresholds;
  onThresholdsChange: (t: Thresholds) => void;
  account: AdAccount;
  onAccountChange: (a: AdAccount) => void;
  metaToken: string;
  onMetaTokenChange: (v: string) => void;
  topN: TopN;
  onTopNChange: (t: TopN) => void;
  csvText: string;
  onCsvTextChange: (t: string) => void;
  onAnalyze: () => void;
  parseError: string | null;
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
  metaToken,
  onMetaTokenChange,
  topN,
  onTopNChange,
  csvText,
  onCsvTextChange,
  onAnalyze,
  parseError,
  onClearData,
  hasData,
  hasAdIds,
  creativesCount,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasAccount = !!account.actId.trim();

  const onFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (text) onCsvTextChange(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

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
            Find as <code className="font-mono">business_id=</code> in URL.
            Helps if you manage multiple businesses.
          </Hint>
        </Field>
      </Section>

      <Section title="Meta token (optional)">
        <Field label="Access token">
          <TextInput
            placeholder="Paste long token here…"
            value={metaToken}
            onChange={onMetaTokenChange}
            type="password"
          />
          <Hint>
            Enables per-row creative downloads. Get a token from{" "}
            <a
              href="https://developers.facebook.com/tools/explorer/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Graph API Explorer
            </a>{" "}
            with <code className="font-mono">ads_read</code> scope. Stored in
            this browser only.
          </Hint>
        </Field>
      </Section>

      <Section
        title="CSV export"
        action={
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-[10px] uppercase tracking-[0.05em] text-accent hover:text-accent/80 font-semibold"
          >
            Upload file
          </button>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={onFilePick}
        />
        <textarea
          value={csvText}
          onChange={(e) => onCsvTextChange(e.target.value)}
          placeholder="Paste Meta Ads Manager CSV here…"
          spellCheck={false}
          className="w-full h-[120px] bg-surface2 border border-border rounded-md px-2.5 py-2 text-[11px] font-mono leading-[1.4] resize-y focus:outline-none focus:border-accent"
        />
        <Hint>
          Include <code className="font-mono">Ad ID</code> column (Customize
          Columns → Identification) for precise links.
        </Hint>
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

      <button
        onClick={onAnalyze}
        disabled={!csvText.trim()}
        className="mt-4 w-full bg-accent hover:bg-accent/85 disabled:bg-surface2 disabled:text-textDim disabled:cursor-not-allowed text-white rounded-md py-[11px] text-[13px] font-semibold transition-colors"
      >
        Analyze
      </button>

      {parseError && (
        <div className="mt-3 text-[11px] text-cut bg-cut/10 border border-cut/30 rounded-md px-2.5 py-2 leading-[1.4]">
          {parseError}
        </div>
      )}

      {hasData && (
        <div className="mt-auto pt-4">
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
        </div>
      )}
    </aside>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.05em] text-textDim">
          {title}
        </div>
        {action}
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
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      spellCheck={false}
      className="w-full bg-surface2 border border-border rounded-md px-2.5 py-2 text-[13px] font-mono focus:outline-none focus:border-accent"
    />
  );
}
