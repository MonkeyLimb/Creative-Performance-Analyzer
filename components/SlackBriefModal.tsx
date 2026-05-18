"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  availableSchools,
  buildSlackBrief,
  filterRowsBySchool,
  recomputeSummary,
} from "@/lib/brief";
import { ReportRow, ReportSummary } from "@/lib/report";

type Props = {
  rows: ReportRow[];
  summary: ReportSummary;
  csvFileName?: string;
  onClose: () => void;
};

export function SlackBriefModal({ rows, summary, csvFileName, onClose }: Props) {
  const schools = useMemo(() => availableSchools(rows), [rows]);
  const [school, setSchool] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [edited, setEdited] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoText = useMemo(() => {
    if (school) {
      const filtered = filterRowsBySchool(rows, school);
      return buildSlackBrief(filtered, recomputeSummary(filtered), generatedAt, {
        scopeLabel: `${school} only`,
        csvFileName,
      });
    }
    return buildSlackBrief(rows, summary, generatedAt, { csvFileName });
  }, [rows, summary, school, generatedAt, csvFileName]);

  // Resetting the edited buffer when the scope changes keeps the textarea
  // in sync with the user's school pick unless they've started editing.
  useEffect(() => {
    setEdited(null);
  }, [school]);

  const text = edited ?? autoText;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand("copy");
      }
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2400);
    }
  };

  const reset = () => {
    setEdited(null);
    setGeneratedAt(new Date());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Slack-ready brief preview"
        className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface2">
          <div className="text-sm font-semibold">
            Slack / email brief — preview & edit
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-textDim hover:text-text text-xs uppercase tracking-wider"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-wider text-textDim">
              Scope
            </label>
            <select
              value={school ?? ""}
              onChange={(e) => setSchool(e.target.value || null)}
              className="bg-surface2 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent"
            >
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s} value={s}>
                  {s} only
                </option>
              ))}
            </select>
          </div>
          <span className="text-[11px] text-textDim">
            Uses Slack mrkdwn (<code>*bold*</code>, bullets) — renders in Slack,
            stays readable in email.
          </span>
        </div>

        <div className="flex-1 min-h-0 p-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setEdited(e.target.value)}
            spellCheck
            className="w-full h-full min-h-[300px] bg-surface2 border border-border rounded p-3 font-mono text-[12.5px] leading-relaxed focus:outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface2">
          <div className="text-xs text-textDim">
            {text.length.toLocaleString()} characters
            {edited != null && (
              <span className="ml-2 text-accent">· edited</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded text-xs uppercase tracking-wider text-textDim hover:text-text border border-border transition-colors"
              title="Restore the auto-generated text"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={copy}
              className="px-3 py-1.5 rounded text-xs uppercase tracking-wider bg-accent text-text hover:opacity-90 transition-opacity"
              style={
                copyState === "copied"
                  ? { backgroundColor: "var(--color-winner)" }
                  : copyState === "error"
                    ? { backgroundColor: "var(--color-cut)" }
                    : undefined
              }
            >
              {copyState === "copied"
                ? "✓ Copied"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy to clipboard"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
