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
import { buildHtmlFullReport } from "@/lib/full-report";
import { fetchThumbnailUrls, urlsToDataUris } from "@/lib/asset-fetch";
import { SlackBriefModal } from "./SlackBriefModal";
import { HtmlBriefPicker } from "./HtmlBriefPicker";
import { Thresholds } from "@/lib/types";

type Props = {
  rows: ReportRow[];
  summary: ReportSummary;
  thresholds: Thresholds;
  metaToken: string;
};

export function ExportMenu({ rows, summary, thresholds, metaToken }: Props) {
  const [open, setOpen] = useState(false);
  const [slackOpen, setSlackOpen] = useState(false);
  const [htmlPickerOpen, setHtmlPickerOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
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

  const exportMarkdownWithThumbs = async (portable: boolean) => {
    setOpen(false);
    const winners = rows.filter(
      (r) => r.status === "winner" && !!r.creative.adId,
    );
    const winnerIds = winners.map((r) => r.creative.adId as string);
    if (winnerIds.length === 0 || !metaToken) {
      // No token or no eligible winners: fall back to text-only export rather
      // than failing loudly. The user can still get the report.
      exportMarkdown();
      return;
    }
    try {
      setBusy(
        portable
          ? `Fetching ${winnerIds.length} thumbnails…`
          : `Fetching ${winnerIds.length} thumbnails…`,
      );
      const urlMap = await fetchThumbnailUrls(winnerIds, metaToken);
      let thumbnails: Map<string, string | null> = urlMap;
      if (portable) {
        const urls = Array.from(urlMap.values()).filter(
          (u): u is string => !!u,
        );
        setBusy(`Embedding ${urls.length} images…`);
        const dataUris = await urlsToDataUris(urls);
        thumbnails = new Map(
          Array.from(urlMap.entries()).map(([id, url]) => [
            id,
            url ? dataUris.get(url) ?? null : null,
          ]),
        );
      }
      const md = buildMarkdownReport(
        rows,
        summary,
        thresholds,
        new Date(),
        thumbnails,
      );
      const suffix = portable ? "-portable.md" : ".md";
      downloadFile(
        reportFilename("md").replace(/\.md$/, suffix),
        md,
        "text/markdown",
      );
    } catch {
      // Fall through to a text-only export so the user still gets something.
      const md = buildMarkdownReport(rows, summary, thresholds, new Date());
      downloadFile(reportFilename("md"), md, "text/markdown");
    } finally {
      setBusy(null);
    }
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

  const exportFullReport = () => {
    const html = buildHtmlFullReport(rows, new Date());
    downloadFile(reportFilename("html"), html, "text/html");
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
        disabled={!!busy}
        className="flex items-center gap-1.5 bg-surface2 hover:bg-surface border border-border hover:border-accent/60 text-text rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-wait"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <DownloadIcon />
        {busy ?? "Export report"}
        {!busy && <span className="text-textDim">▾</span>}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-56 bg-surface border border-border rounded-md shadow-lg overflow-hidden z-20"
        >
          <MenuItem
            onClick={exportFullReport}
            title="Full creative report (HTML)"
            hint="Active/inactive top-10s, best CPL, remove/retain lists"
          />
          <MenuItem
            onClick={exportHtmlBrief}
            title="Synthesized brief (HTML)"
            hint="Shorter: TL;DR + kill/scale + hidden moves"
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
            hint="Tiered summary, no thumbnails"
          />
          <MenuItem
            onClick={() => exportMarkdownWithThumbs(false)}
            title="Markdown + thumbnails"
            hint={
              metaToken
                ? "Winner ads include hosted Meta CDN images"
                : "Needs Meta token in sidebar"
            }
            disabled={!metaToken}
          />
          <MenuItem
            onClick={() => exportMarkdownWithThumbs(true)}
            title="Markdown + thumbnails (portable)"
            hint={
              metaToken
                ? "Images embedded as data URIs — larger file, works offline"
                : "Needs Meta token in sidebar"
            }
            disabled={!metaToken}
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
  disabled,
}: {
  onClick: () => void;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-3 py-2 hover:bg-surface2 transition-colors block disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
