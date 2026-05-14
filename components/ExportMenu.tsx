"use client";

import { useEffect, useRef, useState } from "react";
import {
  ReportRow,
  ReportSummary,
  buildMarkdownReport,
  downloadFile,
  reportFilename,
  rowsToCsv,
} from "@/lib/report";
import { buildHtmlBrief } from "@/lib/brief";
import { SlackBriefModal } from "./SlackBriefModal";
import { HtmlBriefPicker } from "./HtmlBriefPicker";
import { Thresholds } from "@/lib/types";

type Props = {
  rows: ReportRow[];
  summary: ReportSummary;
  thresholds: Thresholds;
};

export function ExportMenu({ rows, summary, thresholds }: Props) {
  const [open, setOpen] = useState(false);
  const [slackOpen, setSlackOpen] = useState(false);
  const [htmlPickerOpen, setHtmlPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const exportCsv = () => {
    downloadFile(reportFilename("csv"), rowsToCsv(rows), "text/csv");
    setOpen(false);
  };

  const exportMarkdown = () => {
    const md = buildMarkdownReport(rows, summary, thresholds, new Date());
    downloadFile(reportFilename("md"), md, "text/markdown");
    setOpen(false);
  };

  const exportHtmlBrief = () => {
    const html = buildHtmlBrief(rows, summary, thresholds, new Date());
    downloadFile(
      reportFilename("html").replace("creative-report", "creative-brief"),
      html,
      "text/html",
    );
    setOpen(false);
  };

  const openSlackBrief = () => {
    setSlackOpen(true);
    setOpen(false);
  };

  const openHtmlPicker = () => {
    setHtmlPickerOpen(true);
    setOpen(false);
  };

  const exportJson = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      thresholds,
      summary,
      rows: rows.map((r) => ({
        ...r.creative,
        tier: r.status,
        rpl: r.rpl,
        revenue: r.revenue,
        roas: r.roas,
        school: r.school,
        program: r.program,
        raw: undefined,
      })),
    };
    downloadFile(
      reportFilename("json"),
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    setOpen(false);
  };

  const print = () => {
    if (typeof window !== "undefined") window.print();
    setOpen(false);
  };

  return (
    <>
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-surface2 hover:bg-surface border border-border hover:border-accent/60 text-text rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <DownloadIcon />
        Export report
        <span className="text-textDim">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-56 bg-surface border border-border rounded-md shadow-lg overflow-hidden z-20"
        >
          <MenuItem
            onClick={exportHtmlBrief}
            title="Synthesized brief (HTML)"
            hint="All schools · TL;DR, rollups, kill/scale"
          />
          <MenuItem
            onClick={openHtmlPicker}
            title="HTML brief by school…"
            hint="Pick a partner for a scoped brief"
          />
          <MenuItem
            onClick={openSlackBrief}
            title="Slack / email brief"
            hint="Preview, edit, copy to clipboard"
          />
          <MenuItem
            onClick={exportCsv}
            title="CSV"
            hint="Spreadsheet-friendly, all columns"
          />
          <MenuItem
            onClick={exportMarkdown}
            title="Markdown report"
            hint="Tiered summary for sharing"
          />
          <MenuItem
            onClick={exportJson}
            title="JSON"
            hint="Full structured data"
          />
          <MenuItem
            onClick={print}
            title="Print / PDF"
            hint="Use browser → Save as PDF"
          />
        </div>
      )}
    </div>
    {slackOpen && (
      <SlackBriefModal
        rows={rows}
        summary={summary}
        onClose={() => setSlackOpen(false)}
      />
    )}
    {htmlPickerOpen && (
      <HtmlBriefPicker
        rows={rows}
        summary={summary}
        thresholds={thresholds}
        onClose={() => setHtmlPickerOpen(false)}
      />
    )}
    </>
  );
}

function MenuItem({
  onClick,
  title,
  hint,
}: {
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full text-left px-3 py-2 hover:bg-surface2 transition-colors block"
    >
      <div className="text-[12px] font-medium text-text">{title}</div>
      <div className="text-[10px] text-textDim mt-0.5">{hint}</div>
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
