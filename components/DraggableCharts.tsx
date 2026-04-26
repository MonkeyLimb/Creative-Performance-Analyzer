"use client";

import { useRef, useState } from "react";

export type ChartPanel = {
  id: string;
  title: string;
  render: () => React.ReactNode;
};

type Props = {
  panels: ChartPanel[];
  order: string[];
  onOrderChange: (order: string[]) => void;
};

export function DraggableCharts({ panels, order, onOrderChange }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const lastOver = useRef<string | null>(null);

  const byId = new Map(panels.map((p) => [p.id, p]));
  const known = order.filter((id) => byId.has(id));
  const missing = panels.map((p) => p.id).filter((id) => !known.includes(id));
  const effective = [...known, ...missing];

  const reorder = (from: string, to: string) => {
    if (from === to) return;
    const next = [...effective];
    const fi = next.indexOf(from);
    const ti = next.indexOf(to);
    if (fi < 0 || ti < 0) return;
    next.splice(fi, 1);
    next.splice(ti, 0, from);
    onOrderChange(next);
  };

  const move = (id: string, dir: -1 | 1) => {
    const next = [...effective];
    const i = next.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onOrderChange(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 md:gap-4">
      {effective.map((id, idx) => {
        const panel = byId.get(id);
        if (!panel) return null;
        const isDragging = dragId === id;
        const isOver = overId === id && dragId && dragId !== id;
        const isFirst = idx === 0;
        const isLast = idx === effective.length - 1;
        return (
          <div
            key={id}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (lastOver.current !== id) {
                lastOver.current = id;
                setOverId(id);
              }
            }}
            onDragLeave={() => {
              if (lastOver.current === id) {
                lastOver.current = null;
                setOverId(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData("text/plain") || dragId;
              if (from && from !== id) reorder(from, id);
              setDragId(null);
              setOverId(null);
            }}
            className={`bg-surface border border-border rounded-lg p-3 sm:p-[18px] transition-all ${
              isDragging ? "opacity-40" : ""
            } ${isOver ? "ring-2 ring-accent" : ""}`}
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="text-[11px] uppercase tracking-[0.05em] text-textDim truncate">
                {panel.title}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => move(id, -1)}
                  disabled={isFirst}
                  className="w-6 h-6 flex items-center justify-center rounded text-textDim hover:text-text hover:bg-surface2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move earlier"
                  aria-label="Move chart earlier"
                >
                  <ChevronUpIcon />
                </button>
                <button
                  type="button"
                  onClick={() => move(id, 1)}
                  disabled={isLast}
                  className="w-6 h-6 flex items-center justify-center rounded text-textDim hover:text-text hover:bg-surface2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move later"
                  aria-label="Move chart later"
                >
                  <ChevronDownIcon />
                </button>
                <span
                  draggable
                  onDragStart={(e) => {
                    setDragId(id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                    lastOver.current = null;
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded text-textDim hover:text-text hover:bg-surface2 cursor-grab active:cursor-grabbing transition-colors"
                  title="Drag to reorder"
                  aria-label="Drag handle"
                >
                  <GripIcon />
                </span>
              </div>
            </div>
            {panel.render()}
          </div>
        );
      })}
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
