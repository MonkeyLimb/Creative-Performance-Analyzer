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
    <div className="p-6 max-w-[1200px]">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-textDim mt-1">
          Drop a Meta Ads Manager export to see tier classification, top
          performers, and the cut list.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
          onClick={() => fileRef.current?.click()}
          className={`bg-surface border rounded-lg p-6 cursor-pointer transition-colors flex flex-col gap-3 min-h-[200px] ${
            dragging
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/40"
          }`}
        >
          <div className="text-[11px] uppercase tracking-[0.05em] text-textDim">
            Upload
          </div>
          <div className="text-[13px]">
            Drop a CSV here, or{" "}
            <span className="text-accent">browse files</span>
          </div>
          <div className="text-[11px] text-textDim mt-auto leading-[1.4]">
            Accepts <code className="font-mono">.csv</code> exported from Ads
            Manager.
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={onFilePick}
          />
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 flex flex-col gap-3 min-h-[200px]">
          <div className="text-[11px] uppercase tracking-[0.05em] text-textDim">
            Or paste
          </div>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={
              "Ad name,Ad ID,Amount spent (USD),Results\nCreative A,123,100,5"
            }
            className="flex-1 w-full bg-surface2 border border-border rounded-md p-2.5 text-[11px] font-mono leading-[1.5] resize-none focus:outline-none focus:border-accent min-h-[100px]"
          />
          <button
            onClick={() => pasted.trim() && onLoad(pasted)}
            disabled={!pasted.trim()}
            className="self-end bg-accent hover:bg-accent/85 disabled:bg-surface2 disabled:text-textDim disabled:cursor-not-allowed text-white rounded-md px-4 py-2 text-[13px] font-semibold transition-colors"
          >
            Parse CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[13px] text-cut bg-cut/10 border border-cut/30 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-lg px-4 py-3 text-[13px] leading-[1.6] text-textDim">
        <span className="text-text font-medium">Need help?</span> Export from
        Ads Manager → Reports → Customize Columns → include{" "}
        <code className="font-mono text-text">Ad name</code>,{" "}
        <code className="font-mono text-text">Ad ID</code>,{" "}
        <code className="font-mono text-text">Amount spent</code>,{" "}
        <code className="font-mono text-text">Results</code>,{" "}
        <code className="font-mono text-text">Cost per result</code>,{" "}
        <code className="font-mono text-text">Impressions</code>,{" "}
        <code className="font-mono text-text">CTR</code>,{" "}
        <code className="font-mono text-text">Quality ranking</code>,{" "}
        <code className="font-mono text-text">Delivery status</code>.
      </div>
    </div>
  );
}
