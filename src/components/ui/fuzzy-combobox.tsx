"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/utils/cn";

export interface ComboboxSuggestion {
  value: string;
  label?: string;
  meta?: string;
}

export interface FuzzyComboboxProps {
  value: string;
  onChange: (next: string) => void;
  suggestions: ComboboxSuggestion[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Tiny fuzzy-matching combobox. Designed for the audit-log action filter
 * but reusable for any "type to narrow a known set, free-text allowed"
 * input. Keyboard model:
 *
 *   ↓ / ↑      navigate the suggestion list
 *   Enter      accept the highlighted suggestion (or commit raw text)
 *   Escape     close the panel without changing the value
 *   Tab        accept and move focus
 *
 * Filter: case-insensitive subsequence match — every character in the
 * query appears in order anywhere in value/label. Prefix matches sort
 * first; ties broken by suggestion order.
 */
export function FuzzyCombobox({
  value,
  onChange,
  suggestions,
  placeholder,
  ariaLabel,
  className,
}: FuzzyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useMemo(() => `combo-${Math.random().toString(36).slice(2, 9)}`, []);

  // Fixed item height matches the per-row padding in the rendered <li>.
  // Used for windowing math; if the row styling changes, update this.
  const ITEM_H = 32;
  // Render window: keep at most this many DOM nodes at once. The list
  // container is max-h-64 (256px) ~ 8 rows. We render a buffer above
  // and below the visible window so fast scrolls don't show blanks.
  const VIRT_BUFFER = 6;
  const LIST_H = 256;
  // Only window when the rendered list would exceed this count —
  // below the threshold the savings don't justify the layout
  // complexity (no per-item padding measurements, no resize observer).
  const VIRT_THRESHOLD = 100;

  // Subsequence-match scorer. Returns:
  //   < 0 → no match
  //   ≥ 0 → match; lower is better (0 = exact prefix, N = match starting
  //         at index N).
  const score = (haystack: string, needle: string): number => {
    if (!needle) return 0;
    const h = haystack.toLowerCase();
    const n = needle.toLowerCase();
    if (h.startsWith(n)) return 0;
    let hi = 0;
    let firstMatch = -1;
    for (let ni = 0; ni < n.length; ni++) {
      while (hi < h.length && h[hi] !== n[ni]) hi++;
      if (hi >= h.length) return -1;
      if (firstMatch < 0) firstMatch = hi;
      hi++;
    }
    return firstMatch + 1;
  };

  // Cap the rendered list at 1000 items (way past anything operational
  // sensible — true scale would mean a refactor anyway). For lists
  // above VIRT_THRESHOLD we window by scroll position so the DOM stays
  // bounded; below that we render the whole filtered set inline.
  const RENDER_CAP = 1000;
  const { filtered, totalMatches } = useMemo(() => {
    const q = value.trim();
    if (!q) {
      const all = suggestions;
      return { filtered: all.slice(0, RENDER_CAP), totalMatches: all.length };
    }
    const scored = suggestions
      .map((s, idx) => {
        const v = score(s.value, q);
        const l = s.label ? score(s.label, q) : -1;
        const best = v >= 0 && (l < 0 || v <= l) ? v : l;
        return { suggestion: s, score: best, idx };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score || a.idx - b.idx);
    return {
      filtered: scored.slice(0, RENDER_CAP).map((x) => x.suggestion),
      totalMatches: scored.length,
    };
  }, [value, suggestions]);

  // Windowing math: only compute a window when the list is large.
  const virtualize = filtered.length > VIRT_THRESHOLD;
  const visibleCount = Math.ceil(LIST_H / ITEM_H) + 2 * VIRT_BUFFER;
  const startIdx = virtualize ? Math.max(0, Math.floor(scrollTop / ITEM_H) - VIRT_BUFFER) : 0;
  const endIdx = virtualize ? Math.min(filtered.length, startIdx + visibleCount) : filtered.length;
  const padTop = virtualize ? startIdx * ITEM_H : 0;
  const padBottom = virtualize ? Math.max(0, (filtered.length - endIdx) * ITEM_H) : 0;

  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered, highlight]);

  // Scroll the highlighted item into view on keyboard nav. In the
  // windowed mode the highlighted item may not be in the DOM yet, so
  // we adjust the container's scrollTop directly using the fixed
  // ITEM_H math.
  useEffect(() => {
    if (!open || !listRef.current) return;
    if (virtualize) {
      const list = listRef.current;
      const targetTop = highlight * ITEM_H;
      const targetBottom = targetTop + ITEM_H;
      if (targetTop < list.scrollTop) list.scrollTop = targetTop;
      else if (targetBottom > list.scrollTop + LIST_H) list.scrollTop = targetBottom - LIST_H;
      return;
    }
    const items = listRef.current.querySelectorAll('[role="option"]');
    const node = items[highlight] as HTMLElement | undefined;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [highlight, open, virtualize]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(filtered.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter") {
            if (open && filtered[highlight]) {
              e.preventDefault();
              commit(filtered[highlight].value);
            } else {
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Tab" && open && filtered[highlight]) {
            commit(filtered[highlight].value);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        role="combobox"
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {open && filtered.length > 0 && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          onScroll={virtualize ? (e) => setScrollTop((e.target as HTMLUListElement).scrollTop) : undefined}
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {/* Top spacer maintains scroll height for items above the window. */}
          {padTop > 0 && <li aria-hidden="true" style={{ height: padTop }} />}
          {filtered.slice(startIdx, endIdx).map((s, offset) => {
            const i = startIdx + offset;
            return (
              <li
                key={s.value}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  // mousedown (not click) so it fires before the input's blur.
                  e.preventDefault();
                  commit(s.value);
                }}
                onMouseEnter={() => setHighlight(i)}
                style={virtualize ? { height: ITEM_H } : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-1.5 text-sm cursor-pointer",
                  i === highlight ? "bg-indigo-50 text-indigo-900" : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <span className="truncate">
                  <span className="font-medium">{s.value}</span>
                  {s.label && <span className="ml-2 text-xs text-gray-500">— {s.label}</span>}
                </span>
                {s.meta && <span className="shrink-0 text-xs text-gray-400">{s.meta}</span>}
              </li>
            );
          })}
          {padBottom > 0 && <li aria-hidden="true" style={{ height: padBottom }} />}
          {totalMatches > filtered.length && (
            <li
              role="presentation"
              className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-500"
            >
              Showing {filtered.length} of {totalMatches} matches — keep typing to narrow.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
