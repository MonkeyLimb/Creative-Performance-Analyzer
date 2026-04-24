"use client";

import { ChangeEvent, useRef, useState } from "react";

type Props = {
  onLoad: (text: string) => void;
  error?: string | null;
};

export function EmptyState({ onLoad, error }: Props) {
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (text) onLoad(text);
    };
    reader.readAsText(file);
  };

  const onFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-8">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight">
            Creative Performance Analyzer
          </div>
          <div className="text-sm text-textDim mt-2">
            Upload a CSV or paste one to get started.
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`border border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
            dragging
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/50 bg-surface"
          }`}
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-sm">
            Drop a Meta Ads Manager CSV here, or{" "}
            <span className="text-accent">browse</span>.
          </div>
          <div className="text-xs text-textDim mt-1">
            Export: Ads Manager → Reports → Export table data
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={onFilePick}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wider text-textDim">
            Or paste
          </div>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Ad name,Ad ID,Amount spent (USD),Results&#10;Creative A,123,100,5"
            className="w-full h-32 bg-surface border border-border rounded-lg p-3 text-xs font-mono resize-none focus:outline-none focus:border-accent"
          />
          <button
            onClick={() => pasted.trim() && onLoad(pasted)}
            disabled={!pasted.trim()}
            className="self-end bg-accent hover:bg-accent/80 disabled:bg-surface2 disabled:text-textDim disabled:cursor-not-allowed text-white rounded px-4 py-1.5 text-sm transition-colors"
          >
            Parse CSV
          </button>
        </div>

        {error && (
          <div className="text-sm text-cut bg-cut/10 border border-cut/30 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
