"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { formatWeekLabel, isCurrentMonth } from "@/lib/dates";
import { setWeekTasks } from "@/app/(app)/project-actions";
import { MarqueeText } from "@/components/ui/MarqueeText";

export type TimelineTask = { id: string; name: string; color: string };
export type TimelineRow = {
  id: string;
  name: string;
  status: string;
  start_on: string | null;
  end_on: string | null;
  projectCode: string;
  clientName: string;
  pms: string[];
  tasksByWeek: Record<string, TimelineTask[]>;
};

export function TimelineGrid({
  weeks,
  rows,
  tasks,
  canWrite,
  thisWeek,
  prevHref,
  nextHref,
}: {
  weeks: string[];
  rows: TimelineRow[];
  tasks: TimelineTask[];
  canWrite: boolean;
  thisWeek: string;
  prevHref: string;
  nextHref: string;
}) {
  const [open, setOpen] = useState<{ ws: string; week: string } | null>(null);
  const [selected, setSelected] = useState<{ ws: string; week: string } | null>(null);
  const [copied, setCopied] = useState<{ ws: string; week: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, TimelineTask[]>>({});
  const [, startTransition] = useTransition();
  const clipRef = useRef<string[]>([]);
  const selectedRef = useRef(selected);
  const rowsRef = useRef(rows);
  const weeksRef = useRef(weeks);
  const overridesRef = useRef(overrides);
  selectedRef.current = selected;
  rowsRef.current = rows;
  weeksRef.current = weeks;
  overridesRef.current = overrides;

  function cellKey(wsId: string, week: string) {
    return `${wsId}:${week}`;
  }

  function cellTasks(wsId: string, week: string) {
    return overridesRef.current[cellKey(wsId, week)] ?? rowsRef.current.find((row) => row.id === wsId)?.tasksByWeek[week] ?? [];
  }

  function saveCell(wsId: string, week: string, ids: string[]) {
    const nextTasks = ids
      .map((id) => tasks.find((task) => task.id === id))
      .filter(Boolean) as TimelineTask[];
    setOverrides((prev) => ({ ...prev, [cellKey(wsId, week)]: nextTasks }));
    startTransition(() => {
      void setWeekTasks(wsId, week, ids);
    });
  }

  function toggle(wsId: string, week: string, current: TimelineTask[], taskId: string) {
    const ids = current.map((t) => t.id);
    const next = ids.includes(taskId) ? ids.filter((id) => id !== taskId) : [...ids, taskId];
    saveCell(wsId, week, next);
  }

  function copySelected() {
    const cell = selectedRef.current;
    if (!cell) return;
    const ids = cellTasks(cell.ws, cell.week).map((task) => task.id);
    clipRef.current = ids;
    setCopied(cell);
    const names = ids
      .map((id) => tasks.find((task) => task.id === id)?.name)
      .filter(Boolean)
      .join(", ");
    void navigator.clipboard.writeText(names).catch(() => undefined);
  }

  function pasteSelected() {
    const cell = selectedRef.current;
    if (!cell || !canWrite) return;
    let ids = clipRef.current;
    void navigator.clipboard
      .readText()
      .then((raw) => {
        const text = raw.trim();
        if (!text) {
          saveCell(cell.ws, cell.week, ids);
          return;
        }
        const fromNames = text
          .split(/[,;\n]+/)
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => tasks.find((task) => task.name.toLowerCase() === name.toLowerCase())?.id)
          .filter(Boolean) as string[];
        saveCell(cell.ws, cell.week, fromNames.length ? fromNames : ids);
      })
      .catch(() => {
        saveCell(cell.ws, cell.week, ids);
      });
  }

  function focusCell(ws: string, week: string) {
    const next = { ws, week };
    selectedRef.current = next;
    setSelected(next);
    setOpen(null);
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-tl-cell="${ws}::${week}"]`)?.focus();
    });
  }

  function moveSelected(dRow: number, dCol: number) {
    const cell = selectedRef.current;
    const rowList = rowsRef.current;
    const weekList = weeksRef.current;
    if (!cell || !rowList.length || !weekList.length) return;
    const r = rowList.findIndex((row) => row.id === cell.ws);
    const c = weekList.indexOf(cell.week);
    if (r < 0 || c < 0) return;
    const nextR = Math.max(0, Math.min(rowList.length - 1, r + dRow));
    const nextC = Math.max(0, Math.min(weekList.length - 1, c + dCol));
    focusCell(rowList[nextR].id, weekList[nextC]);
  }

  function clearSelected(moveLeft: boolean) {
    const cell = selectedRef.current;
    if (!cell || !canWrite) return;
    saveCell(cell.ws, cell.week, []);
    if (moveLeft) moveSelected(0, -1);
  }

  useEffect(() => {
    function typingInField() {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) return false;
      return Boolean(el.closest("input:not([type=checkbox]), textarea, select"));
    }

    function onKey(event: KeyboardEvent) {
      if (typingInField()) return;
      if (event.key === "Escape") {
        setOpen(null);
        return;
      }

      const copyPaste = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
      if (copyPaste) {
        if (event.key === "c" || event.key === "C") {
          if (!selectedRef.current) return;
          event.preventDefault();
          copySelected();
        }
        if ((event.key === "v" || event.key === "V") && canWrite) {
          if (!selectedRef.current) return;
          event.preventDefault();
          pasteSelected();
        }
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!selectedRef.current) return;

      if (event.key === "Delete" && canWrite) {
        event.preventDefault();
        clearSelected(false);
        return;
      }
      if (event.key === "Backspace" && canWrite) {
        event.preventDefault();
        clearSelected(true);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelected(0, -1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveSelected(0, 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelected(-1, 0);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelected(1, 0);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canWrite, tasks]);

  return (
    <div className="w-full">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-16 z-50 w-[13rem] border-b border-line bg-white px-3 py-2.5 text-left font-medium text-muted shadow-[1px_0_0_0_var(--line)]">
              Workstream
            </th>
            <th className="sticky top-16 z-40 w-[6.5rem] border-b border-line bg-white px-2 text-left font-medium text-muted">PM</th>
            <th className="sticky top-16 z-40 w-8 border-b border-line bg-white px-0">
              <Link href={prevHref} className="flex items-center justify-center text-navy hover:text-cyan" aria-label="Semanas anteriores">
                ‹
              </Link>
            </th>
            {weeks.map((week) => {
              const current = week === thisWeek;
              const month = isCurrentMonth(week);
              return (
                <th
                  key={week}
                  className={`sticky top-16 z-40 border-b border-line px-1 py-2.5 font-medium ${
                    current ? "bg-[#d9eef6] text-cyan" : month ? "bg-canvas text-ink" : "bg-white text-muted"
                  }`}
                >
                  {formatWeekLabel(week)}
                  {current ? <div className="text-[11px] font-normal">hoy</div> : null}
                </th>
              );
            })}
            <th className="sticky top-16 z-40 w-8 border-b border-line bg-white px-0">
              <Link href={nextHref} className="flex items-center justify-center text-navy hover:text-cyan" aria-label="Semanas siguientes">
                ›
              </Link>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="sticky left-0 z-10 overflow-hidden bg-white px-3 py-2 shadow-[1px_0_0_0_var(--line)]">
                <MarqueeText
                  href={`/workstreams/${row.id}`}
                  text={row.name}
                  className="text-base font-medium text-ink hover:text-cyan"
                />
                <div className="truncate text-muted">
                  {row.clientName} · {row.projectCode}
                </div>
              </td>
              <td className="truncate px-2 text-navy">{row.pms.join(", ") || "—"}</td>
              <td />
              {weeks.map((week) => {
                const cellTasks = overrides[cellKey(row.id, week)] ?? row.tasksByWeek[week] ?? [];
                const isOpen = open?.ws === row.id && open.week === week;
                const current = week === thisWeek;
                return (
                  <td
                    key={week}
                    className={`relative px-0.5 py-1 align-top ${current ? "bg-cyan/5" : ""}`}
                  >
                    <button
                      type="button"
                      data-tl-cell={`${row.id}::${week}`}
                      onClick={() => {
                        setSelected({ ws: row.id, week });
                        if (!canWrite) return;
                        setOpen(isOpen ? null : { ws: row.id, week });
                      }}
                      className={`flex min-h-10 w-full min-w-0 flex-col gap-0.5 rounded-lg border px-1 py-1 pb-3 text-left focus:outline-none ${
                        isOpen || (selected?.ws === row.id && selected.week === week)
                          ? copied?.ws === row.id && copied.week === week
                            ? "border-dashed border-cyan"
                            : "border-cyan"
                          : copied?.ws === row.id && copied.week === week
                            ? "border-dashed border-cyan/60"
                            : "border-transparent hover:border-line"
                      }`}
                    >
                      {cellTasks.length === 0 ? (
                        <span className="text-line">·</span>
                      ) : (
                        cellTasks.map((task) => (
                          <span
                            key={task.id}
                            className="truncate rounded-md px-1 py-0.5 text-xs text-white"
                            style={{ background: task.color }}
                          >
                            {task.name}
                          </span>
                        ))
                      )}
                    </button>
                    {isOpen ? (
                      <div className="absolute z-40 mt-1 max-h-56 w-52 overflow-auto rounded-2xl border border-line bg-white p-3">
                        {tasks.map((task) => {
                          const checked = cellTasks.some((t) => t.id === task.id);
                          return (
                            <label key={task.id} className="flex items-center gap-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(row.id, week, cellTasks, task.id)}
                              />
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: task.color }} />
                              <span className="text-navy">{task.name}</span>
                            </label>
                          );
                        })}
                        <div className="pt-2 text-muted">{cellTasks.length} seleccionadas</div>
                      </div>
                    ) : null}
                  </td>
                );
              })}
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
