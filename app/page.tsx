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
import { classify } from "@/lib/tiers";
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
import { CplChart, TopN } from "@/components/CplChart";
import { SpendCplScatter } from "@/components/ScatterChart";
import {
  CreativesTable,
  DeliveryFilter,
} from "@/components/CreativesTable";
import { InsightCallout } from "@/components/InsightCallout";

const TIER_FILTERS: Array<TierStatus | "all"> = [
  "all",
  "winner",
  "watch",
  "cut",
];
const DELIVERY_FILTERS: DeliveryFilter[] = ["all", "active", "inactive"];

export default function DashboardPage() {
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [account, setAccount] = useState<AdAccount>({ actId: "" });
  const [creatives, setCreatives] = useState<Creative[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierStatus | "all">("all");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [topN, setTopN] = useState<TopN>(10);
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
  };

  const handleClear = () => {
    setCreatives(null);
    setError(null);
  };

  const decorated = useMemo(() => {
    if (!creatives) return [];
    return creatives.map((c) => ({
      creative: c,
      status: classify(c, thresholds),
    }));
  }, [creatives, thresholds]);

  const metrics = useMemo(() => {
    if (!creatives || creatives.length === 0) return null;
    const totalSpend = creatives.reduce((s, c) => s + c.spend, 0);
    const totalResults = creatives.reduce((s, c) => s + c.results, 0);
    const blendedCpl = totalResults > 0 ? totalSpend / totalResults : null;
    const winners = decorated
      .filter((d) => d.status === "winner")
      .map((d) => d.creative);
    const cuts = decorated
      .filter((d) => d.status === "cut")
      .map((d) => d.creative);
    const cutSpend = cuts.reduce((s, c) => s + c.spend, 0);
    const winnerResults = winners.reduce((s, c) => s + c.results, 0);
    const winnerShare =
      totalResults > 0 ? (winnerResults / totalResults) * 100 : 0;
    const activeCount = creatives.filter((c) => c.delivery === "active").length;
    const topPerformer =
      [...winners]
        .filter((c) => c.cpl != null)
        .sort((a, b) => (a.cpl as number) - (b.cpl as number))[0] ?? null;
    return {
      totalSpend,
      totalResults,
      blendedCpl,
      winners,
      cuts,
      cutSpend,
      winnerShare,
      activeCount,
      topPerformer,
    };
  }, [creatives, decorated]);

  const hasAdIds = !!creatives?.some((c) => c.adId);

  return (
    <div className="flex">
      <Sidebar
        thresholds={thresholds}
        onThresholdsChange={setThresholds}
        account={account}
        onAccountChange={setAccount}
        topN={topN}
        onTopNChange={setTopN}
        onClearData={handleClear}
        hasData={!!creatives}
        hasAdIds={hasAdIds}
        creativesCount={creatives?.length ?? 0}
      />

      <main className="flex-1 min-w-0">
        {!creatives || !metrics ? (
          <EmptyState onLoad={handleLoad} error={error} />
        ) : (
          <div className="p-6 flex flex-col gap-5 max-w-[1400px]">
            <header>
              <h1 className="text-xl font-semibold tracking-tight">
                Dashboard
              </h1>
              <p className="text-sm text-textDim mt-0.5">
                {creatives.length} creative
                {creatives.length === 1 ? "" : "s"} ·{" "}
                <span className="font-mono">
                  {fmtCurrency(metrics.totalSpend)}
                </span>{" "}
                spend ·{" "}
                <span className="font-mono">
                  {fmtNumber(metrics.totalResults)}
                </span>{" "}
                leads
              </p>
            </header>

            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard
                label="Total spend"
                value={fmtCurrency(metrics.totalSpend)}
              />
              <MetricCard
                label="Total leads"
                value={fmtNumber(metrics.totalResults)}
              />
              <MetricCard
                label="Blended CPL"
                value={fmtCurrency(metrics.blendedCpl)}
                hint={`Target ${fmtCurrency(thresholds.targetCpl)}`}
              />
              <MetricCard
                label="Winners"
                value={fmtNumber(metrics.winners.length)}
                hint={`${creatives.length} total`}
                accent="#1D9E75"
              />
              <MetricCard
                label="Cut list"
                value={fmtNumber(metrics.cuts.length)}
                hint={`${fmtCurrency(metrics.cutSpend)} wasted`}
                accent="#E24B4A"
              />
              <MetricCard
                label="Active now"
                value={fmtNumber(metrics.activeCount)}
                hint="Currently delivering"
              />
            </section>

            <InsightCallout
              topPerformer={metrics.topPerformer}
              cuts={metrics.cuts}
              cutSpend={metrics.cutSpend}
              winnerShare={metrics.winnerShare}
              hasAnyLeads={metrics.totalResults > 0}
            />

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Panel
                title={`CPL by creative (top ${topN === "all" ? "all" : topN})`}
              >
                <CplChart
                  creatives={creatives}
                  thresholds={thresholds}
                  topN={topN}
                />
              </Panel>
              <Panel title="Spend vs CPL">
                <SpendCplScatter
                  creatives={creatives}
                  thresholds={thresholds}
                />
              </Panel>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-xs uppercase tracking-wider text-textDim">
                  All creatives · {creatives.length}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <PillGroup
                    options={DELIVERY_FILTERS}
                    active={deliveryFilter}
                    onChange={setDeliveryFilter}
                    render={(o) => capitalize(o)}
                  />
                  <PillGroup
                    options={TIER_FILTERS}
                    active={tierFilter}
                    onChange={setTierFilter}
                    render={(o) =>
                      o === "all" ? (
                        "All"
                      ) : (
                        <StatusBadge status={o as TierStatus} />
                      )
                    }
                  />
                </div>
              </div>

              <CreativesTable
                creatives={creatives}
                thresholds={thresholds}
                filter={tierFilter}
                deliveryFilter={deliveryFilter}
                account={account}
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

function PillGroup<T extends string>({
  options,
  active,
  onChange,
  render,
}: {
  options: readonly T[];
  active: T;
  onChange: (v: T) => void;
  render: (o: T) => React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${
            active === opt
              ? "bg-surface2 text-text border border-border"
              : "text-textDim hover:text-text border border-transparent"
          }`}
        >
          {render(opt)}
        </button>
      ))}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
