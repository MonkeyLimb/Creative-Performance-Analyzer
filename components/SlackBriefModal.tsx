"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  initialText: string;
  onClose: () => void;
};

export function SlackBriefModal({ initialText, onClose }: Props) {
  const [text, setText] = useState(initialText);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Disable background scroll while modal is open
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

  const reset = () => setText(initialText);

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

        <div className="px-4 py-2 text-xs text-textDim border-b border-border">
          Edit freely below. Uses Slack mrkdwn (<code>*bold*</code>, bullets) —
          renders in Slack, stays readable in email.
        </div>

        <div className="flex-1 min-h-0 p-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck
            className="w-full h-full min-h-[300px] bg-surface2 border border-border rounded p-3 font-mono text-[12.5px] leading-relaxed focus:outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface2">
          <div className="text-xs text-textDim">
            {text.length.toLocaleString()} characters
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
