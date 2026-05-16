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
  loadChartHidden,
  loadChartOrder,
  loadChartSizes,
  loadMatchOverrides,
  loadRplOverrides,
  loadSidebarCollapsed,
  loadThresholds,
  saveAccount,
  saveChartHidden,
  saveChartOrder,
  saveChartSizes,
  saveMatchOverrides,
  saveRplOverrides,
  saveSidebarCollapsed,
  saveThresholds,
} from "@/lib/storage";
import { loadMetaToken, saveMetaToken } from "@/lib/meta-token";
import { fmtCurrency, fmtNumber, fmtRoas } from "@/lib/format";
import { SAMPLE_CSV } from "@/lib/sample-csv";
import { localStorageCreativeStore } from "@/lib/persistence/storage";
import { mergeCreatives, summarizeReport } from "@/lib/persistence/merge";
import {
  CreativeMatchOverrides,
  EMPTY_RPL_OVERRIDES,
  RplOverrides,
  SCHOOL_REGISTRY,
  deriveRoas,
} from "@/lib/schools";
import { useTheme } from "@/lib/theme";
import { ReportRow, ReportSummary } from "@/lib/report";
import { Sidebar } from "@/components/Sidebar";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { CplChart, TopN } from "@/components/CplChart";
import { SpendVsLeadsScatter } from "@/components/ScatterChart";
import { RoasChart } from "@/components/RoasChart";
import { RoasScatter } from "@/components/RoasScatter";
import {
  CreativesTable,
  DeliveryFilter,
} from "@/components/CreativesTable";
import { InsightCallout } from "@/components/InsightCallout";
import {
  DraggableCharts,
  ChartPanel,
  ChartSize,
} from "@/components/DraggableCharts";
import { ExportMenu } from "@/components/ExportMenu";

const TIER_FILTERS: Array<TierStatus | "all"> = [
  "all",
  "winner",
  "watch",
  "cut",
];
const DELIVERY_FILTERS: DeliveryFilter[] = ["all", "active", "inactive"];

const DEFAULT_CHART_ORDER = [
  "cpl",
  "roas-bar",
  "spend-leads",
  "roas-scatter",
];

export default function DashboardPage() {
  const { theme, toggle: toggleTheme } = useTheme();
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
  const [matchOverrides, setMatchOverrides] =
    useState<CreativeMatchOverrides>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [chartOrder, setChartOrder] = useState<string[]>(DEFAULT_CHART_ORDER);
  const [chartHidden, setChartHidden] = useState<string[]>([]);
  const [chartSizes, setChartSizes] = useState<Record<string, ChartSize>>({});
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const creativeStore = useMemo(() => localStorageCreativeStore(), []);

  useEffect(() => {
    setThresholds(loadThresholds());
    const a = loadAccount();
    if (a) setAccount(a);
    setMetaToken(loadMetaToken());
    setRplOverrides(loadRplOverrides());
    setMatchOverrides(loadMatchOverrides());
    const storedCollapsed = window.localStorage.getItem(
      "cpa.sidebar.collapsed.v1",
    );
    if (storedCollapsed == null) {
      // First visit: auto-collapse on phones/small tablets so content has room.
      setSidebarCollapsed(window.innerWidth < 768);
    } else {
      setSidebarCollapsed(loadSidebarCollapsed());
    }
    const stored = loadChartOrder();
    if (stored.length) setChartOrder(stored);
    setChartHidden(loadChartHidden());
    setChartSizes(loadChartSizes());
    const persisted = creativeStore.load();
    if (persisted && persisted.length) setCreatives(persisted);
    setHydrated(true);
  }, [creativeStore]);

  useEffect(() => {
    if (!hydrated) return;
    if (creatives && creatives.length) creativeStore.save(creatives);
    else creativeStore.clear();
  }, [creatives, hydrated, creativeStore]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

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

  useEffect(() => {
    if (hydrated) saveMatchOverrides(matchOverrides);
  }, [matchOverrides, hydrated]);

  useEffect(() => {
    if (hydrated) saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed, hydrated]);

  useEffect(() => {
    if (hydrated) saveChartOrder(chartOrder);
  }, [chartOrder, hydrated]);

  useEffect(() => {
    if (hydrated) saveChartHidden(chartHidden);
  }, [chartHidden, hydrated]);

  useEffect(() => {
    if (hydrated) saveChartSizes(chartSizes);
  }, [chartSizes, hydrated]);

  const handleAnalyze = () => {
    if (!csvText.trim()) {
      setParseError("Paste CSV data or upload a file first.");
      return;
    }
    const result = parseCsv(csvText);
    if (!result.ok) {
      setParseError(result.error);
      return;
    }
    setParseError(null);
    const { merged, report } = mergeCreatives(
      creatives ?? [],
      result.creatives,
    );
    setCreatives(merged);
    setToast(summarizeReport(report));
  };

  const handleClear = () => {
    setCreatives(null);
    setParseError(null);
    setToast(null);
    creativeStore.clear();
  };

  const decorated = useMemo(() => {
    if (!creatives) return [];
    return creatives.map((c) => {
      const r = deriveRoas(c, SCHOOL_REGISTRY, rplOverrides, matchOverrides);
      return {
        creative: c,
        status: classify(c, thresholds, r.roas),
        roas: r,
      };
    });
  }, [creatives, thresholds, rplOverrides, matchOverrides]);

  const metrics = useMemo(() => {
    if (!creatives || creatives.length === 0) return null;
    const totalSpend = creatives.reduce((s, c) => s + c.spend, 0);
    const totalResults = creatives.reduce((s, c) => s + c.results, 0);
    const blendedCpl = totalResults > 0 ? totalSpend / totalResults : null;
    let totalRevenue = 0;
    let revenueAttributed = false;
    for (const c of creatives) {
      const r = deriveRoas(c, SCHOOL_REGISTRY, rplOverrides, matchOverrides);
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
    const watch = decorated
      .filter((d) => d.status === "watch")
      .map((d) => d.creative);
    const cuts = decorated
      .filter((d) => d.status === "cut")
      .map((d) => d.creative);
    const cutSpend = cuts.reduce((s, c) => s + c.spend, 0);
    const winnerResults = winners.reduce((s, c) => s + c.results, 0);
    const winnerShare =
      totalResults > 0 ? (winnerResults / totalResults) * 100 : 0;
    const activeCount = creatives.filter((c) => c.delivery === "active").length;
    const winnersWithRoas = decorated.filter((d) => d.status === "winner");
    const byRoas = winnersWithRoas
      .filter((d) => d.roas.roas != null)
      .sort((a, b) => (b.roas.roas as number) - (a.roas.roas as number));
    const byCpl = winnersWithRoas
      .filter((d) => d.creative.cpl != null)
      .sort(
        (a, b) => (a.creative.cpl as number) - (b.creative.cpl as number),
      );
    const topPerformer = (byRoas[0] ?? byCpl[0])?.creative ?? null;
    return {
      totalSpend,
      totalResults,
      totalRevenue: revenueAttributed ? totalRevenue : null,
      blendedCpl,
      blendedRoas,
      winners,
      watch,
      cuts,
      cutSpend,
      winnerShare,
      activeCount,
      topPerformer,
    };
  }, [creatives, decorated, rplOverrides, matchOverrides]);

  const reportRows: ReportRow[] = useMemo(
    () =>
      decorated.map((d) => ({
        creative: d.creative,
        status: d.status,
        rpl: d.roas.rpl,
        revenue: d.roas.revenue,
        roas: d.roas.roas,
        school: d.roas.match?.school ?? null,
        program: d.roas.match?.program ?? null,
      })),
    [decorated],
  );

  const reportSummary: ReportSummary | null = useMemo(() => {
    if (!metrics) return null;
    return {
      totalSpend: metrics.totalSpend,
      totalResults: metrics.totalResults,
      totalRevenue: metrics.totalRevenue,
      blendedCpl: metrics.blendedCpl,
      blendedRoas: metrics.blendedRoas,
      winners: metrics.winners.length,
      watch: metrics.watch.length,
      cuts: metrics.cuts.length,
      cutSpend: metrics.cutSpend,
      winnerShare: metrics.winnerShare,
      activeCount: metrics.activeCount,
      topPerformer: metrics.topPerformer?.adName ?? null,
    };
  }, [metrics]);

  const hasAdIds = !!creatives?.some((c) => c.adId);

  const chartPanels: ChartPanel[] = useMemo(() => {
    if (!creatives) return [];
    const topNControl = { value: topN, onChange: setTopN };
    return [
      {
        id: "cpl",
        title: `CPL by creative (top ${topN === "all" ? "all" : topN})`,
        topN: topNControl,
        render: () => (
          <CplChart
            creatives={creatives}
            thresholds={thresholds}
            rplOverrides={rplOverrides}
            matchOverrides={matchOverrides}
            topN={topN}
          />
        ),
      },
      {
        id: "roas-bar",
        title: `ROAS by creative (top ${topN === "all" ? "all" : topN})`,
        topN: topNControl,
        render: () => (
          <RoasChart
            creatives={creatives}
            rplOverrides={rplOverrides}
            matchOverrides={matchOverrides}
            topN={topN}
          />
        ),
      },
      {
        id: "spend-leads",
        title: "Spend vs Leads",
        render: () => (
          <SpendVsLeadsScatter
            creatives={creatives}
            thresholds={thresholds}
            rplOverrides={rplOverrides}
            matchOverrides={matchOverrides}
          />
        ),
      },
      {
        id: "roas-scatter",
        title: "Spend vs ROAS",
        render: () => (
          <RoasScatter
            creatives={creatives}
            rplOverrides={rplOverrides}
            matchOverrides={matchOverrides}
          />
        ),
      },
    ];
  }, [creatives, thresholds, rplOverrides, matchOverrides, topN]);

  return (
    <div className="flex min-h-screen w-full">
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
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        theme={theme}
        onThemeToggle={toggleTheme}
      />

      <main className="flex-1 min-w-0 w-full">
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-4 right-4 z-50 bg-surface2 border border-border rounded-md shadow-lg px-3.5 py-2 text-xs text-text flex items-center gap-3 max-w-sm"
          >
            <span className="font-mono tabular-nums">{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-textDim hover:text-text text-[14px] leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        {!creatives || !metrics || !reportSummary ? (
          <EmptyState />
        ) : (
          <div className="p-3 sm:p-4 md:p-6 flex flex-col gap-4 md:gap-5 w-full">
            <header className="flex items-start justify-between gap-4 flex-wrap">
              <div>
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
              </div>
              <ExportMenu
                rows={reportRows}
                summary={reportSummary}
                thresholds={thresholds}
              />
            </header>

            <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-3">
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
                      ? "var(--color-winner)"
                      : metrics.blendedRoas >= 1
                        ? "var(--color-watch)"
                        : "var(--color-cut)"
                    : undefined
                }
              />
              <MetricCard
                label="Winners"
                value={fmtNumber(metrics.winners.length)}
                hint={`${creatives.length} total`}
                accent="var(--color-winner)"
              />
              <MetricCard
                label="Cut list"
                value={fmtNumber(metrics.cuts.length)}
                hint={`${fmtCurrency(metrics.cutSpend)} wasted`}
                accent="var(--color-cut)"
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

            <section aria-label="Performance charts">
              <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <div className="text-xs uppercase tracking-wider text-textDim">
                  Charts · drag, resize, hide
                </div>
                {(chartOrder.join(",") !== DEFAULT_CHART_ORDER.join(",") ||
                  chartHidden.length > 0 ||
                  Object.keys(chartSizes).length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setChartOrder(DEFAULT_CHART_ORDER);
                      setChartHidden([]);
                      setChartSizes({});
                    }}
                    className="text-[10px] uppercase tracking-[0.05em] text-textDim hover:text-text transition-colors"
                  >
                    Reset layout
                  </button>
                )}
              </div>
              <DraggableCharts
                panels={chartPanels}
                order={chartOrder}
                onOrderChange={setChartOrder}
                hidden={chartHidden}
                onHiddenChange={setChartHidden}
                sizes={chartSizes}
                onSizesChange={setChartSizes}
              />
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
                matchOverrides={matchOverrides}
                onMatchOverridesChange={setMatchOverrides}
              />
            </section>
          </div>
        )}
      </main>
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
