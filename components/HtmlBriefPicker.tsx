"use client";

import { useEffect, useMemo, useState } from "react";
import {
  availableSchools,
  buildHtmlBrief,
  filterRowsBySchool,
  recomputeSummary,
} from "@/lib/brief";
import { downloadFile, reportFilename } from "@/lib/report";
import { ReportRow, ReportSummary } from "@/lib/report";
import { Thresholds } from "@/lib/types";

type Props = {
  rows: ReportRow[];
  summary: ReportSummary;
  thresholds: Thresholds;
  csvFileName?: string;
  onClose: () => void;
};

export function HtmlBriefPicker({
  rows,
  summary,
  thresholds,
  csvFileName,
  onClose,
}: Props) {
  const schools = useMemo(() => availableSchools(rows), [rows]);
  const [school, setSchool] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = () => {
    const scoped = school ? filterRowsBySchool(rows, school) : rows;
    const sum = school ? recomputeSummary(scoped) : summary;
    const html = buildHtmlBrief(scoped, sum, thresholds, new Date(), {
      scopeLabel: school ? `${school} only` : undefined,
      csvFileName,
    });
    const stem = school ? `creative-brief-${slug(school)}` : "creative-brief";
    downloadFile(
      reportFilename("html").replace("creative-report", stem),
      html,
      "text/html",
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose scope for HTML brief"
        className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border bg-surface2 text-sm font-semibold">
          HTML brief — pick scope
        </div>

        <div className="px-4 py-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="brief-scope"
              checked={school === null}
              onChange={() => setSchool(null)}
              className="accent-accent"
            />
            <span className="text-sm">All schools</span>
          </label>
          {schools.length === 0 ? (
            <p className="text-xs text-textDim mt-1">
              No partner-matched creatives — only the All option is available.
            </p>
          ) : (
            schools.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="brief-scope"
                  checked={school === s}
                  onChange={() => setSchool(s)}
                  className="accent-accent"
                />
                <span className="text-sm">{s} only</span>
              </label>
            ))
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-surface2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs uppercase tracking-wider text-textDim hover:text-text border border-border transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={download}
            className="px-3 py-1.5 rounded text-xs uppercase tracking-wider bg-accent text-text hover:opacity-90 transition-opacity"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
