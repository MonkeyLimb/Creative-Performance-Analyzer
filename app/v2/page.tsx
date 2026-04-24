"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdAccount,
  Creative,
  DEFAULT_THRESHOLDS,
  Thresholds,
  TierStatus,
} from "@/lib/types";
import { parseCsv } from "@/lib/csv";
import { summarize } from "@/lib/tiers";
import { buildAdsManagerUrl } from "@/lib/ads-manager-url";
import {
  loadAccount,
  loadThresholds,
  saveAccount,
  saveThresholds,
} from "@/lib/storage";
import { fmtCurrency, fmtNumber } from "@/lib/format";
import { Sidebar } from "@/components/Sidebar";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { CplChart } from "@/components/CplChart";
import { SpendCplScatter } from "@/components/ScatterChart";
import { CreativesTable } from "@/components/CreativesTable";
import { TierDistributionBar } from "@/components/TierDistributionBar";

const FILTERS: Array<TierStatus | "all"> = ["all", "winner", "watch", "cut", "new"];

export default function DashboardV2Page() {
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [account, setAccount] = useState<AdAccount>({ actId: "" });
  const [creatives, setCreatives] = useState<Creative[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TierStatus | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setThresholds(loadThresholds());
    const a = loadAccount();
    if (a) setAccount(a);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveThresholds(thresholds);
  }, [thresholds, hydrated]);

  useEffect(() => {
    if (hydrated) saveAccount(account);
  }, [account, hydrated]);

  const handleLoad = (text: string) => {
    const result = parseCsv(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setCreatives(result.creatives);
    setSelected(new Set());
  };

  const handleClear = () => {
    setCreatives(null);
    setError(null);
    setSelected(new Set());
  };

  const summary = useMemo(
    () => (creatives ? summarize(creatives, thresholds) : []),
    [creatives, thresholds],
  );

  const totals = useMemo(() => {
    if (!creatives) return null;
    const spend = creatives.reduce((s, c) => s + c.spend, 0);
    const results = creatives.reduce((s, c) => s + c.results, 0);
    return {
      spend,
      results,
      cpl: results > 0 ? spend / results : null,
      count: creatives.length,
    };
  }, [creatives]);

  const hasAdIds = !!creatives?.some((c) => c.adId);

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = (keys: string[]) => {
    setSelected((prev) => {
      const allOn = keys.every((k) => prev.has(k));
      const next = new Set(prev);
      if (allOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const openInAdsManager = () => {
    if (!creatives || selected.size === 0 || !account.actId) return;
    const picked = creatives.filter(
      (c) => selected.has(c.adId || c.adName),
    );
    const adNames = picked.map((c) => c.adName);
    const adIds = picked.map((c) => c.adId).filter((v): v is string => !!v);
    const url = buildAdsManagerUrl({
      account,
      adNames,
      adIds: adIds.length > 0 ? adIds : undefined,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex">
      <Sidebar
        thresholds={thresholds}
        onThresholdsChange={setThresholds}
        account={account}
        onAccountChange={setAccount}
        onClearData={handleClear}
        hasData={!!creatives}
      />

      <main className="flex-1 min-w-0">
        {!creatives ? (
          <EmptyState onLoad={handleLoad} error={error} />
        ) : (
          <div className="p-8 flex flex-col gap-6 max-w-[1400px]">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  Dashboard
                  <span className="ml-2 text-xs font-normal text-accent align-middle">
                    v2 preview
                  </span>
                </h1>
                <p className="text-sm text-textDim mt-0.5">
                  {totals?.count} creatives ·{" "}
                  <span className="font-mono">
                    {fmtCurrency(totals?.spend)}
                  </span>{" "}
                  spend ·{" "}
                  <span className="font-mono">
                    {fmtNumber(totals?.results)}
                  </span>{" "}
                  results
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openInAdsManager}
                  disabled={selected.size === 0 || !account.actId}
                  title={
                    !account.actId
                      ? "Set Ad account ID in the sidebar"
                      : selected.size === 0
                      ? "Select creatives in the table"
                      : undefined
                  }
                  className="bg-accent hover:bg-accent/80 disabled:bg-surface2 disabled:text-textDim disabled:cursor-not-allowed text-white rounded px-3 py-1.5 text-sm transition-colors"
                >
                  Open {selected.size || ""} in Ads Manager →
                </button>
              </div>
            </header>

            <section className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              <MetricCard
                label="Total spend"
                value={fmtCurrency(totals?.spend)}
              />
              <MetricCard
                label="Overall CPL"
                value={fmtCurrency(totals?.cpl)}
                hint={`Target ${fmtCurrency(thresholds.targetCpl)}`}
              />
              <TierDistributionBar
                className="lg:col-span-3"
                summary={summary}
                activeFilter={filter}
                onFilterChange={setFilter}
              />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Panel title="CPL by creative (lowest 30)">
                <CplChart creatives={creatives} thresholds={thresholds} />
              </Panel>
              <Panel title="Spend vs CPL">
                <SpendCplScatter
                  creatives={creatives}
                  thresholds={thresholds}
                />
              </Panel>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  {FILTERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        filter === f
                          ? "bg-surface2 text-text border border-border"
                          : "text-textDim hover:text-text border border-transparent"
                      }`}
                    >
                      {f === "all" ? (
                        "All"
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <StatusBadge status={f} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-textDim">
                  {selected.size > 0 && `${selected.size} selected`}
                </div>
              </div>

              <CreativesTable
                creatives={creatives}
                thresholds={thresholds}
                filter={filter}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleAll={toggleAll}
                hasAdIds={hasAdIds}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-textDim mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}
