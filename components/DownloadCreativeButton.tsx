"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

type Props = {
  adId?: string;
  adName: string;
  token: string;
};

export function DownloadCreativeButton({ adId, adName, token }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const disabled = !adId || !token || status === "loading";
  const tooltip = !adId
    ? "No Ad ID for this row"
    : !token
      ? "Paste a Meta token in the sidebar"
      : status === "loading"
        ? "Downloading…"
        : "Download creative assets (Shift+click for raw creative JSON)";

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !adId) return;
    const debug = e.shiftKey;
    setStatus("loading");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/meta/asset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ adId, ...(debug ? { debug: "shape" } : {}) }),
      });
      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        if (res.status === 401) msg = "Meta token expired or invalid — refresh it.";
        throw new Error(msg);
      }
      const found = res.headers.get("x-asset-found");
      const added = res.headers.get("x-asset-added");
      const shape = res.headers.get("x-creative-shape");
      const blob = await res.blob();
      const filename =
        parseFilename(res.headers.get("content-disposition")) ||
        (debug ? `${adName}-creative.json` : `${adName}.zip`);
      triggerDownload(blob, filename);
      setStatus("success");
      if (debug) {
        setInfo("creative.json");
      } else if (found && added) {
        const a = Number(added);
        const f = Number(found);
        const base = a < f ? `${a} of ${f} assets` : `${a} asset${a === 1 ? "" : "s"}`;
        setInfo(a < 2 && shape ? `${base} · ${shape}` : base);
      }
      setTimeout(() => setStatus((s) => (s === "success" ? "idle" : s)), 8000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={tooltip}
        aria-label={tooltip}
        className={`inline-flex items-center justify-center w-7 h-7 rounded border text-xs transition-colors ${
          disabled
            ? "border-border text-textDim cursor-not-allowed"
            : "border-border text-text hover:bg-surface2 hover:border-accent"
        }`}
      >
        {status === "loading" ? (
          <Spinner />
        ) : (
          <DownloadIcon />
        )}
      </button>
      {status === "error" && error && (
        <span
          className="text-[10px] text-cut max-w-[140px] text-right leading-tight"
          title={error}
        >
          {error.length > 40 ? `${error.slice(0, 40)}…` : error}
        </span>
      )}
      {status === "success" && info && (
        <span className="text-[10px] text-winner leading-tight max-w-[200px] text-right break-words">
          {info}
        </span>
      )}
    </div>
  );
}

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const m = disposition.match(/filename="?([^";]+)"?/i);
  return m ? m[1] : null;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
