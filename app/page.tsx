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
  loadRplOverrides,
  loadThresholds,
  saveAccount,
  saveRplOverrides,
  saveThresholds,
} from "@/lib/storage";
import { loadMetaToken, saveMetaToken } from "@/lib/meta-token";
import { fmtCurrency, fmtNumber, fmtRoas } from "@/lib/format";
import { SAMPLE_CSV } from "@/lib/sample-csv";
import {
  EMPTY_RPL_OVERRIDES,
  RplOverrides,
  SCHOOL_REGISTRY,
  deriveRoas,
} from "@/lib/schools";
import { Sidebar } from "@/components/Sidebar";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { CplChart, TopN } from "@/components/CplChart";
import { SpendVsLeadsScatter } from "@/components/ScatterChart";
import { RoasChart } from "@/components/RoasChart";
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
  const [metaToken, setMetaToken] = useState<string>("");
  const [csvText, setCsvText] = useState<string>(SAMPLE_CSV);
  const [creatives, setCreatives] = useState<Creative[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierStatus | "all">("all");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [topN, setTopN] = useState<TopN>(10);
  const [rplOverrides, setRplOverrides] =
    useState<RplOverrides>(EMPTY_RPL_OVERRIDES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setThresholds(loadThresholds());
    const a = loadAccount();
    if (a) setAccount(a);
    setMetaToken(loadMetaToken());
    setRplOverrides(loadRplOverrides());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveThresholds(thresholds);
  }, [thresholds, hydrated]);

  useEffect(() => {
    if (hydrated) saveAccount(account);
  }, [account, hydrated]);

  useEffect(() => {
    if (hydrated) saveMetaToken(metaToken);
  }, [metaToken, hydrated]);

  useEffect(() => {
    if (hydrated) saveRplOverrides(rplOverrides);
  }, [rplOverrides, hydrated]);

  const handleAnalyze = () => {
    if (!csvText.trim()) {
      setParseError("Paste CSV data or upload a file first.");
      return;
    }
    const result = parseCsv(csvText);
    if (!result.ok) {
      setParseError(result.error);
      setCreatives(null);
      return;
    }
    setParseError(null);
    setCreatives(result.creatives);
  };

  const handleClear = () => {
    setCreatives(null);
    setParseError(null);
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
    let totalRevenue = 0;
    let revenueAttributed = false;
    for (const c of creatives) {
      const r = deriveRoas(c, SCHOOL_REGISTRY, rplOverrides);
      if (r.revenue != null) {
        totalRevenue += r.revenue;
        revenueAttributed = true;
      }
    }
    const blendedRoas =
      revenueAttributed && totalSpend > 0 ? totalRevenue / totalSpend : null;
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
      totalRevenue: revenueAttributed ? totalRevenue : null,
      blendedCpl,
      blendedRoas,
      winners,
      cuts,
      cutSpend,
      winnerShare,
      activeCount,
      topPerformer,
    };
  }, [creatives, decorated, rplOverrides]);

  const hasAdIds = !!creatives?.some((c) => c.adId);

  return (
    <div className="flex">
      <Sidebar
        thresholds={thresholds}
        onThresholdsChange={setThresholds}
        account={account}
        onAccountChange={setAccount}
        metaToken={metaToken}
        onMetaTokenChange={setMetaToken}
        topN={topN}
        onTopNChange={setTopN}
        csvText={csvText}
        onCsvTextChange={setCsvText}
        onAnalyze={handleAnalyze}
        parseError={parseError}
        onClearData={handleClear}
        hasData={!!creatives}
        hasAdIds={hasAdIds}
        creativesCount={creatives?.length ?? 0}
        rplOverrides={rplOverrides}
        onRplOverridesChange={setRplOverrides}
      />

      <main className="flex-1 min-w-0">
        {!creatives || !metrics ? (
          <EmptyState />
        ) : (
          <div className="p-6 flex flex-col gap-5 max-w-[1400px]">
            <header>
              <h1 className="text-xl font-semibold tracking-tight">
                Dashboard
              </h1>
              <p className="text-sm text-textDim mt-0.5">
                {creatives.length} creative
                {creatives.length === 1 ? "" : "s"} ·{" "}
                <span className="font-mono tabular-nums">
                  {fmtCurrency(metrics.totalSpend)}
                </span>{" "}
                spend ·{" "}
                <span className="font-mono tabular-nums">
                  {fmtNumber(metrics.totalResults)}
                </span>{" "}
                leads
              </p>
            </header>

            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
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
              />
              <MetricCard
                label="Blended ROAS"
                value={fmtRoas(metrics.blendedRoas)}
                hint={
                  metrics.totalRevenue != null
                    ? `${fmtCurrency(metrics.totalRevenue)} rev`
                    : "Add school keywords to ad names"
                }
                accent={
                  metrics.blendedRoas != null
                    ? metrics.blendedRoas >= 2
                      ? "#1D9E75"
                      : metrics.blendedRoas >= 1
                        ? "#EF9F27"
                        : "#E24B4A"
                    : undefined
                }
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
              cutCpl={thresholds.cutCpl}
              winnerShare={metrics.winnerShare}
              hasAnyLeads={metrics.totalResults > 0}
            />

            <section
              className="overflow-x-auto -mx-6 px-6 pb-2"
              aria-label="Performance charts"
            >
              <div className="flex gap-3 min-w-max">
                <ScrollPanel
                  title={`CPL by creative (top ${topN === "all" ? "all" : topN})`}
                >
                  <CplChart
                    creatives={creatives}
                    thresholds={thresholds}
                    topN={topN}
                  />
                </ScrollPanel>
                <ScrollPanel
                  title={`ROAS by creative (top ${topN === "all" ? "all" : topN})`}
                >
                  <RoasChart
                    creatives={creatives}
                    rplOverrides={rplOverrides}
                    topN={topN}
                  />
                </ScrollPanel>
                <ScrollPanel title="Spend vs Leads">
                  <SpendVsLeadsScatter
                    creatives={creatives}
                    thresholds={thresholds}
                  />
                </ScrollPanel>
              </div>
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
                metaToken={metaToken}
                rplOverrides={rplOverrides}
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
    <div className="bg-surface border border-border rounded-lg p-[18px]">
      <div className="text-[11px] uppercase tracking-[0.05em] text-textDim mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}

function ScrollPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-[18px] w-[560px] shrink-0">
      <div className="text-[11px] uppercase tracking-[0.05em] text-textDim mb-3">
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
