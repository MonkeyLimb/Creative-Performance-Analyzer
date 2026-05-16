"use client";

import { useEffect, useMemo, useState } from "react";
import {
  checkCompliance,
  Flag,
  PARTNERS,
  Partner,
} from "@/lib/compliance";

const STORAGE_KEY = "cpa.compliance.draft.v1";
const PARTNER_KEY = "cpa.compliance.partner.v1";

export function CompliancePanel() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedText = window.localStorage.getItem(STORAGE_KEY) ?? "";
    const savedPartner = window.localStorage.getItem(PARTNER_KEY);
    if (savedText) setText(savedText);
    if (savedPartner && (PARTNERS as string[]).includes(savedPartner)) {
      setPartner(savedPartner as Partner);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, text);
  }, [text, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (partner) window.localStorage.setItem(PARTNER_KEY, partner);
    else window.localStorage.removeItem(PARTNER_KEY);
  }, [partner, hydrated]);

  const flags = useMemo(() => checkCompliance(text, partner), [text, partner]);
  const blocks = flags.filter((f) => f.severity === "block");
  const warns = flags.filter((f) => f.severity === "warn");

  return (
    <section className="bg-surface border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface2 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-textDim">
            Compliance pre-check
          </span>
          {text.trim() && (
            <span className="flex items-center gap-2 text-xs">
              {blocks.length > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded font-semibold"
                  style={{
                    color: "var(--color-cut)",
                    backgroundColor:
                      "color-mix(in srgb, var(--color-cut) 15%, transparent)",
                  }}
                >
                  {blocks.length} block{blocks.length === 1 ? "" : "s"}
                </span>
              )}
              {warns.length > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded font-semibold"
                  style={{
                    color: "var(--color-watch)",
                    backgroundColor:
                      "color-mix(in srgb, var(--color-watch) 15%, transparent)",
                  }}
                >
                  {warns.length} warn{warns.length === 1 ? "" : "s"}
                </span>
              )}
              {blocks.length === 0 && warns.length === 0 && (
                <span
                  className="px-1.5 py-0.5 rounded font-semibold"
                  style={{
                    color: "var(--color-winner)",
                    backgroundColor:
                      "color-mix(in srgb, var(--color-winner) 15%, transparent)",
                  }}
                >
                  Clean
                </span>
              )}
            </span>
          )}
        </div>
        <span className="text-textDim text-xs">{open ? "▴ Hide" : "▾ Open"}</span>
      </button>

      {open && (
        <div className="border-t border-border p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs uppercase tracking-wider text-textDim">
              Partner
            </label>
            <select
              value={partner ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setPartner(v === "" ? null : (v as Partner));
              }}
              className="bg-surface2 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">— None (universal rules only) —</option>
              {PARTNERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="text-xs text-textDim">
              Universal rules always apply; partner rules add on top.
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste draft ad copy here…"
            spellCheck
            rows={6}
            className="w-full bg-surface2 border border-border rounded p-3 font-mono text-sm focus:outline-none focus:border-accent resize-y"
          />

          {text.trim() === "" ? (
            <p className="text-sm text-textDim">
              Paste draft copy above to see violations and suggested fixes.
            </p>
          ) : flags.length === 0 ? (
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-winner)" }}
            >
              No rule violations detected{" "}
              {partner ? `for ${partner}` : "(universal rules)"}.
            </p>
          ) : (
            <FlagList flags={flags} />
          )}
        </div>
      )}
    </section>
  );
}

function FlagList({ flags }: { flags: Flag[] }) {
  const blocks = flags.filter((f) => f.severity === "block");
  const warns = flags.filter((f) => f.severity === "warn");

  return (
    <div className="flex flex-col gap-3">
      {blocks.length > 0 && (
        <FlagGroup title="Blocks (must fix before submit)" flags={blocks} tone="cut" />
      )}
      {warns.length > 0 && (
        <FlagGroup title="Warnings (review)" flags={warns} tone="watch" />
      )}
    </div>
  );
}

function FlagGroup({
  title,
  flags,
  tone,
}: {
  title: string;
  flags: Flag[];
  tone: "cut" | "watch";
}) {
  const color = tone === "cut" ? "var(--color-cut)" : "var(--color-watch)";
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="text-xs uppercase tracking-wider font-semibold"
        style={{ color }}
      >
        {title} · {flags.length}
      </div>
      <ul className="flex flex-col gap-1.5">
        {flags.map((f, i) => (
          <li
            key={`${f.ruleId}-${i}`}
            className="bg-surface2 border border-border rounded px-3 py-2 text-sm flex flex-col gap-1"
          >
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-medium">{f.message}</span>
              {f.excerpt && (
                <code
                  className="font-mono text-xs px-1.5 py-0.5 rounded"
                  style={{
                    color,
                    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                  }}
                >
                  {f.excerpt}
                </code>
              )}
            </div>
            {f.suggestion && (
              <div className="text-xs text-textDim">→ {f.suggestion}</div>
            )}
            <div className="text-[10px] uppercase tracking-wider text-textDim">
              {f.ruleId}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
