"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AngleIcon } from "@/components/ui/AngleIcon";

export type SortDir = "asc" | "desc";

export function TimelineColumnHeader({
  label,
  align = "left",
  sortKey,
  currentSort,
  onSort,
  options,
  selected,
  onFilter,
}: {
  label: string;
  align?: "left" | "center";
  sortKey: string;
  currentSort: { key: string; dir: SortDir } | null;
  onSort: (key: string, dir: SortDir) => void;
  options: { value: string; label: string }[];
  selected: string[] | null;
  onFilter: (values: string[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const allValues = options.map((o) => o.value);
  const active = selected !== null;
  const checked = new Set(selected ?? allValues);
  const sorted = currentSort?.key === sortKey ? currentSort.dir : null;
  const visible = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const node = event.target as Node;
      if (box.current?.contains(node) || menu.current?.contains(node)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggleValue(value: string) {
    const next = new Set(checked);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    if (next.size === allValues.length) onFilter(null);
    else onFilter([...next]);
  }

  function openMenu() {
    const r = box.current?.getBoundingClientRect();
    if (r) {
      const left = Math.min(r.left, window.innerWidth - 240);
      setPos({ top: r.bottom + 4, left: Math.max(8, left) });
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={box} className={`relative ${align === "center" ? "flex justify-center" : ""}`}>
      <div className="flex min-w-0 items-center gap-0.5 whitespace-nowrap">
        {label ? (
          <button
            type="button"
            onClick={() => onSort(sortKey, sorted === "asc" ? "desc" : "asc")}
            className={`flex min-w-0 items-center gap-0.5 truncate text-left font-medium leading-none ${active || sorted ? "text-cyan" : "text-muted"} hover:text-cyan`}
          >
            <span className="truncate">{label}</span>
            {sorted ? <AngleIcon direction={sorted === "asc" ? "up" : "down"} className="opacity-80" /> : null}
          </button>
        ) : null}
        <button
          type="button"
          aria-label={`Filtrar ${label || "Estado"}`}
          aria-expanded={open}
          onClick={openMenu}
          className={`shrink-0 px-0.5 leading-none ${active ? "text-cyan" : "text-muted"} hover:text-cyan`}
        >
          <AngleIcon direction={open ? "up" : "down"} />
        </button>
      </div>
      {open
        ? createPortal(
            <div
              ref={menu}
              className="fixed z-[120] w-56 rounded-2xl border border-line bg-white p-2"
              style={{ top: pos.top, left: pos.left }}
            >
              <button
                type="button"
                className="block w-full rounded-xl px-2 py-1.5 text-left text-navy hover:bg-canvas"
                onClick={() => onSort(sortKey, "asc")}
              >
                Ordenar A → Z
              </button>
              <button
                type="button"
                className="block w-full rounded-xl px-2 py-1.5 text-left text-navy hover:bg-canvas"
                onClick={() => onSort(sortKey, "desc")}
              >
                Ordenar Z → A
              </button>
              <div className="my-1 border-t border-line" />
              <div className="flex gap-1 px-1 pb-1 text-sm">
                <button type="button" className="text-cyan hover:underline" onClick={() => onFilter(null)}>
                  Seleccionar todas
                </button>
                <span className="text-line">·</span>
                <button type="button" className="text-cyan hover:underline" onClick={() => onFilter([])}>
                  Deseleccionar todas
                </button>
              </div>
              {options.length > 8 ? (
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar"
                  className="mb-1 w-full rounded-xl border border-line px-2 py-1 text-navy"
                />
              ) : null}
              <div className="max-h-56 overflow-auto">
                {visible.length === 0 ? (
                  <div className="px-2 py-2 text-muted">Sin coincidencias</div>
                ) : (
                  visible.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-canvas">
                      <input
                        type="checkbox"
                        checked={checked.has(option.value)}
                        onChange={() => toggleValue(option.value)}
                      />
                      <span className="min-w-0 truncate text-navy">{option.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
