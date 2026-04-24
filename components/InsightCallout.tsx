import { Creative } from "@/lib/types";
import { fmtCurrency } from "@/lib/format";

type Props = {
  topPerformer: Creative | null;
  cuts: Creative[];
  cutSpend: number;
  winnerShare: number;
  hasAnyLeads: boolean;
};

export function InsightCallout({
  topPerformer,
  cuts,
  cutSpend,
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
        <span className="font-mono">{fmtCurrency(cutSpend)}</span> at high CPL.
      </Shell>
    );
  }

  return (
    <Shell>
      Top performer:{" "}
      <strong className="text-winner">{topPerformer.adName}</strong> at{" "}
      <span className="font-mono">{fmtCurrency(topPerformer.cpl)}</span> CPL.{" "}
      Pause <strong className="text-cut">{cuts.length}</strong> creative
      {cuts.length === 1 ? "" : "s"} burning{" "}
      <span className="font-mono">{fmtCurrency(cutSpend)}</span>. Winners drive{" "}
      <strong className="text-winner">{winnerShare.toFixed(1)}%</strong> of
      leads.
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-lg px-4 py-3 text-sm leading-relaxed">
      {children}
    </div>
  );
}
