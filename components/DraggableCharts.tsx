"use client";

import { useEffect, useRef, useState } from "react";

export type ChartSize = "sm" | "md" | "lg";

export type ChartPanel = {
  id: string;
  title: string;
  /** Some panels (CPL/ROAS bar) accept a Top N control rendered in the menu. */
  topN?: TopNControl;
  render: () => React.ReactNode;
};

export type TopNControl = {
  value: 5 | 10 | 20 | "all";
  onChange: (v: 5 | 10 | 20 | "all") => void;
};

const SIZE_CLASS: Record<ChartSize, string> = {
  sm: "w-[360px] sm:w-[420px]",
  md: "w-[420px] sm:w-[560px]",
  lg: "w-[520px] sm:w-[760px]",
};

const SIZE_LABEL: Record<ChartSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

type Props = {
  panels: ChartPanel[];
  order: string[];
  onOrderChange: (order: string[]) => void;
  hidden: string[];
  onHiddenChange: (hidden: string[]) => void;
  sizes: Record<string, ChartSize>;
  onSizesChange: (sizes: Record<string, ChartSize>) => void;
};

export function DraggableCharts({
  panels,
  order,
  onOrderChange,
  hidden,
  onHiddenChange,
  sizes,
  onSizesChange,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const lastOver = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const byId = new Map(panels.map((p) => [p.id, p]));
  const known = order.filter((id) => byId.has(id));
  const missing = panels.map((p) => p.id).filter((id) => !known.includes(id));
  const effective = [...known, ...missing];
  const visible = effective.filter((id) => !hidden.includes(id));

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
    const list = [...visible];
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    // Rebuild full order: keep hidden in place, splice visible into the
    // positions they previously occupied.
    const visibleSlots = effective
      .map((eid, idx) => (hidden.includes(eid) ? -1 : idx))
      .filter((idx) => idx >= 0);
    const next = [...effective];
    list.forEach((id, k) => {
      next[visibleSlots[k]] = id;
    });
    onOrderChange(next);
  };

  const hide = (id: string) => {
    if (hidden.includes(id)) return;
    onHiddenChange([...hidden, id]);
  };

  const show = (id: string) => {
    onHiddenChange(hidden.filter((h) => h !== id));
  };

  const setSize = (id: string, size: ChartSize) => {
    onSizesChange({ ...sizes, [id]: size });
  };

  return (
    <div className="flex flex-col gap-2">
      {hidden.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-textDim">
          <span className="uppercase tracking-[0.05em]">Hidden:</span>
          {hidden.map((id) => {
            const p = byId.get(id);
            if (!p) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => show(id)}
                className="inline-flex items-center gap-1 bg-surface2 border border-border hover:border-accent/60 rounded-full px-2 py-0.5 text-text transition-colors"
                title={`Show ${p.title}`}
              >
                <PlusIcon />
                <span>{p.title}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={scrollerRef}
        className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 pb-2"
      >
        <div className="flex gap-3 md:gap-4 min-w-max">
          {visible.map((id, idx) => {
            const panel = byId.get(id);
            if (!panel) return null;
            const isDragging = dragId === id;
            const isOver = overId === id && dragId && dragId !== id;
            const size = sizes[id] ?? "md";
            const isFirst = idx === 0;
            const isLast = idx === visible.length - 1;
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
                className={`bg-surface border border-border rounded-lg p-3 sm:p-[18px] shrink-0 transition-all ${
                  SIZE_CLASS[size]
                } ${isDragging ? "opacity-40" : ""} ${
                  isOver ? "ring-2 ring-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="text-[11px] uppercase tracking-[0.05em] text-textDim truncate">
                    {panel.title}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <ToolButton
                      onClick={() => move(id, -1)}
                      disabled={isFirst}
                      label="Move earlier"
                    >
                      <ChevronLeftIcon />
                    </ToolButton>
                    <ToolButton
                      onClick={() => move(id, 1)}
                      disabled={isLast}
                      label="Move later"
                    >
                      <ChevronRightIcon />
                    </ToolButton>
                    <PanelMenu
                      panel={panel}
                      size={size}
                      onSizeChange={(s) => setSize(id, s)}
                      onHide={() => hide(id)}
                    />
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
      </div>
    </div>
  );
}

function ToolButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-6 h-6 flex items-center justify-center rounded text-textDim hover:text-text hover:bg-surface2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

function PanelMenu({
  panel,
  size,
  onSizeChange,
  onHide,
}: {
  panel: ChartPanel;
  size: ChartSize;
  onSizeChange: (s: ChartSize) => void;
  onHide: () => void;
}) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="relative" ref={ref}>
      <ToolButton
        onClick={() => setOpen((v) => !v)}
        label="Chart options"
      >
        <GearIcon />
      </ToolButton>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-48 bg-surface border border-border rounded-md shadow-lg overflow-hidden z-30"
        >
          <div className="px-3 py-2 border-b border-border">
            <div className="text-[10px] uppercase tracking-[0.05em] text-textDim mb-1.5">
              Width
            </div>
            <div className="flex items-center gap-1">
              {(["sm", "md", "lg"] as ChartSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSizeChange(s)}
                  className={`flex-1 px-2 py-1 rounded text-[11px] transition-colors ${
                    size === s
                      ? "bg-accent text-accentFg"
                      : "bg-surface2 text-text hover:bg-surface"
                  }`}
                >
                  {SIZE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          {panel.topN && (
            <div className="px-3 py-2 border-b border-border">
              <div className="text-[10px] uppercase tracking-[0.05em] text-textDim mb-1.5">
                Top N
              </div>
              <div className="flex items-center gap-1">
                {([5, 10, 20, "all"] as const).map((n) => (
                  <button
                    key={String(n)}
                    type="button"
                    onClick={() => panel.topN?.onChange(n)}
                    className={`flex-1 px-2 py-1 rounded text-[11px] transition-colors ${
                      panel.topN?.value === n
                        ? "bg-accent text-accentFg"
                        : "bg-surface2 text-text hover:bg-surface"
                    }`}
                  >
                    {n === "all" ? "All" : n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onHide();
            }}
            className="w-full text-left px-3 py-2 text-[12px] text-text hover:bg-surface2 transition-colors flex items-center gap-2"
          >
            <EyeOffIcon />
            Hide chart
          </button>
        </div>
      )}
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

function ChevronLeftIcon() {
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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function EyeOffIcon() {
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
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
