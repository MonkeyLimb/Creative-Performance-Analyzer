import { Creative } from "@/lib/types";
import { fmtCurrency } from "@/lib/format";

type Props = {
  topPerformer: Creative | null;
  cuts: Creative[];
  cutSpend: number;
  cutCpl: number;
  winnerShare: number;
  hasAnyLeads: boolean;
};

export function InsightCallout({
  topPerformer,
  cuts,
  cutSpend,
  cutCpl,
  winnerShare,
  hasAnyLeads,
}: Props) {
  if (!hasAnyLeads) {
    return (
      <Shell>
        No creatives have leads yet.{" "}
        <strong className="text-cut">{cuts.length}</strong> ad
        {cuts.length === 1 ? "" : "s"} spent money with zero results.
      </Shell>
    );
  }

  if (!topPerformer || topPerformer.cpl == null) {
    return (
      <Shell>
        <strong className="text-cut">{cuts.length}</strong> creative
        {cuts.length === 1 ? " is" : "s are"} burning{" "}
        <span className="font-mono tabular-nums">{fmtCurrency(cutSpend)}</span>{" "}
        at high CPL.
      </Shell>
    );
  }

  return (
    <Shell>
      Top performer:{" "}
      <strong className="text-winner">{topPerformer.adName}</strong> at{" "}
      <span className="font-mono tabular-nums">
        {fmtCurrency(topPerformer.cpl)}
      </span>{" "}
      CPL. Pause <strong className="text-cut">{cuts.length}</strong> creative
      {cuts.length === 1 ? "" : "s"} (
      <span className="font-mono tabular-nums">{fmtCurrency(cutSpend)}</span>{" "}
      spent, 0 leads or CPL ≥{" "}
      <span className="font-mono tabular-nums">${cutCpl}</span>). Winners drive{" "}
      <strong className="text-winner">{winnerShare.toFixed(1)}%</strong> of
      leads.
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-lg px-[18px] py-3.5 text-[13px] leading-[1.6]">
      {children}
    </div>
  );
}
