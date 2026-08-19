"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addWeeks, formatWeekLabel, isCurrentMonth, STATUS_LABEL, toISODate } from "@/lib/dates";
import { setWeekTasks } from "@/app/(app)/project-actions";
import { MarqueeText } from "@/components/ui/MarqueeText";
import { AngleIcon } from "@/components/ui/AngleIcon";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { TimelineColumnHeader, type SortDir } from "@/components/TimelineColumnHeader";

export type TimelineTask = { id: string; name: string; color: string };
export type TimelineRow = {
  id: string;
  name: string;
  status: string;
  start_on: string | null;
  end_on: string | null;
  clientName: string;
  projectId: string;
  projectCode: string;
  projectStatus: string;
  pms: string[];
  tasksByWeek: Record<string, TimelineTask[]>;
};

const STATUS_RANK: Record<string, number> = {
  en_curso: 0,
  pausado: 1,
  mantenimiento: 2,
  finalizado: 3,
};

const EMPTY = "—";
const COMPACT_WEEKS = 6;
const SCROLL_Y_KEY = "timeline-scroll-y";
const KEEP_SCROLL_KEY = "timeline-keep-scroll";
const COLLAPSED_KEY = "timeline-collapsed-projects";

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));
}

const NONE = "__none__";

function paramsList(search: URLSearchParams, key: string) {
  const all = search.getAll(key);
  if (all.length === 0) return null;
  if (all.length === 1 && all[0] === NONE) return [];
  return all.filter((value) => value !== NONE);
}

function sliceWeeks(weeks: string[], thisWeek: string, count: number) {
  if (weeks.length <= count) return weeks;
  const i = weeks.indexOf(thisWeek);
  if (i < 0) return weeks.slice(0, count);
  const start = Math.min(Math.max(0, i - 2), weeks.length - count);
  return weeks.slice(start, start + count);
}

type ProjectGroup = {
  projectId: string;
  projectCode: string;
  projectStatus: string;
  clientName: string;
  pms: string[];
  workstreams: TimelineRow[];
};

function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function unionTasks(lists: TimelineTask[][]) {
  const seen = new Map<string, TimelineTask>();
  for (const list of lists) {
    for (const task of list) seen.set(task.id, task);
  }
  return [...seen.values()];
}

export function TimelineGrid({
  weeks,
  rows,
  tasks,
  canWrite,
  thisWeek,
}: {
  weeks: string[];
  rows: TimelineRow[];
  tasks: TimelineTask[];
  canWrite: boolean;
  thisWeek: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1100,
  );
  const [open, setOpen] = useState<{ ws: string; week: string } | null>(null);
  const [editorPos, setEditorPos] = useState<{ top: number; left: number } | null>(null);
  const [selected, setSelected] = useState<{ ws: string; week: string } | null>(null);
  const [copied, setCopied] = useState<{ ws: string; week: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, TimelineTask[]>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const [tip, setTip] = useState<{
    rowId: string;
    week: string;
    top: number;
    left: number;
    place: "left" | "right";
  } | null>(null);
  const [, startTransition] = useTransition();
  const clipRef = useRef<string[]>([]);
  const selectedRef = useRef(selected);
  const rowsRef = useRef(rows);
  const weeksRef = useRef(weeks);
  const overridesRef = useRef(overrides);
  const tipTimer = useRef<number | null>(null);
  selectedRef.current = selected;
  rowsRef.current = rows;
  overridesRef.current = overrides;

  const sortKey = searchParams.get("sort");
  const sortDir = (searchParams.get("dir") === "desc" ? "desc" : "asc") as SortDir;
  const currentSort = sortKey ? { key: sortKey, dir: sortDir } : null;
  const statusFilter = paramsList(searchParams, "st");
  const clientFilter = paramsList(searchParams, "cl");
  const pmFilter = paramsList(searchParams, "pm");
  const nameFilter = paramsList(searchParams, "ws");

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = (width: number) => setCompact(width < 1100);
    apply(el.clientWidth);
    const ro = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visibleWeeks = compact ? sliceWeeks(weeks, thisWeek, COMPACT_WEEKS) : weeks;
  weeksRef.current = visibleWeeks;

  useLayoutEffect(() => {
    if (sessionStorage.getItem(KEEP_SCROLL_KEY) !== "1") return;
    const y = Number(sessionStorage.getItem(SCROLL_Y_KEY) ?? "0");
    sessionStorage.removeItem(KEEP_SCROLL_KEY);
    sessionStorage.removeItem(SCROLL_Y_KEY);
    window.scrollTo(0, y);
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [weeks[0]]);

  function rememberScroll() {
    sessionStorage.setItem(KEEP_SCROLL_KEY, "1");
    sessionStorage.setItem(SCROLL_Y_KEY, String(window.scrollY));
  }

  function toggleCollapsed(projectId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      sessionStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function persistCollapsed(next: Set<string>) {
    sessionStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    setCollapsed(next);
  }

  const statusOptions = useMemo(
    () =>
      uniqueSorted(rows.map((row) => row.status)).map((value) => ({
        value,
        label: STATUS_LABEL[value] ?? value,
      })),
    [rows],
  );
  const nameOptions = useMemo(
    () => uniqueSorted(rows.map((row) => row.name)).map((value) => ({ value, label: value })),
    [rows],
  );
  const clientOptions = useMemo(
    () =>
      uniqueSorted(rows.map((row) => row.clientName || EMPTY)).map((value) => ({ value, label: value })),
    [rows],
  );
  const pmOptions = useMemo(
    () =>
      uniqueSorted(rows.flatMap((row) => (row.pms.length ? row.pms : [EMPTY]))).map((value) => ({
        value,
        label: value,
      })),
    [rows],
  );

  const viewRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (statusFilter && !statusFilter.includes(row.status)) return false;
      if (nameFilter && !nameFilter.includes(row.name)) return false;
      if (clientFilter && !clientFilter.includes(row.clientName || EMPTY)) return false;
      if (pmFilter) {
        const names = row.pms.length ? row.pms : [EMPTY];
        if (!names.some((name) => pmFilter.includes(name))) return false;
      }
      return true;
    });
    const copy = [...filtered];
    const dir = sortDir === "desc" ? -1 : 1;
    copy.sort((a, b) => {
      if (!sortKey) {
        return (
          (a.clientName || EMPTY).localeCompare(b.clientName || EMPTY, "es") ||
          a.name.localeCompare(b.name, "es")
        );
      }
      if (sortKey === "status") {
        return dir * ((STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.name.localeCompare(b.name, "es"));
      }
      if (sortKey === "client") {
        return dir * (a.clientName || EMPTY).localeCompare(b.clientName || EMPTY, "es") || a.name.localeCompare(b.name, "es");
      }
      if (sortKey === "pm") {
        return dir * (a.pms[0] || EMPTY).localeCompare(b.pms[0] || EMPTY, "es") || a.name.localeCompare(b.name, "es");
      }
      return dir * a.name.localeCompare(b.name, "es");
    });
    return copy;
  }, [rows, statusFilter, nameFilter, clientFilter, pmFilter, sortKey, sortDir]);

  const groups = useMemo(() => {
    const byProject = new Map<string, ProjectGroup>();
    for (const row of viewRows) {
      const existing = byProject.get(row.projectId);
      if (existing) {
        existing.workstreams.push(row);
        for (const pm of row.pms) {
          if (!existing.pms.includes(pm)) existing.pms.push(pm);
        }
      } else {
        byProject.set(row.projectId, {
          projectId: row.projectId,
          projectCode: row.projectCode,
          projectStatus: row.projectStatus,
          clientName: row.clientName,
          pms: [...row.pms],
          workstreams: [row],
        });
      }
    }
    const list = [...byProject.values()];
    const dir = sortDir === "desc" ? -1 : 1;
    list.sort((a, b) => {
      if (!sortKey) {
        return (a.clientName || EMPTY).localeCompare(b.clientName || EMPTY, "es");
      }
      if (sortKey === "client") {
        return dir * (a.clientName || EMPTY).localeCompare(b.clientName || EMPTY, "es");
      }
      if (sortKey === "status") {
        return dir * ((STATUS_RANK[a.projectStatus] ?? 9) - (STATUS_RANK[b.projectStatus] ?? 9));
      }
      if (sortKey === "pm") {
        return dir * (a.pms[0] || EMPTY).localeCompare(b.pms[0] || EMPTY, "es");
      }
      return dir * (a.workstreams[0]?.name ?? "").localeCompare(b.workstreams[0]?.name ?? "", "es");
    });
    return list;
  }, [viewRows, sortKey, sortDir]);

  const visibleWorkstreams = useMemo(
    () => groups.flatMap((group) => (collapsed.has(group.projectId) ? [] : group.workstreams)),
    [groups, collapsed],
  );

  rowsRef.current = visibleWorkstreams;

  function hrefWith(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const q = params.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    router.replace(hrefWith(mutate), { scroll: false });
  }

  function setFilter(key: string, values: string[] | null) {
    replaceParams((params) => {
      params.delete(key);
      if (values === null) return;
      if (values.length === 0) params.set(key, NONE);
      else for (const value of values) params.append(key, value);
    });
  }

  function setSort(key: string, dir: SortDir) {
    replaceParams((params) => {
      params.set("sort", key);
      params.set("dir", dir);
    });
  }

  const step = compact ? COMPACT_WEEKS : 8;
  const prevHref = hrefWith((params) => {
    params.set("start", toISODate(addWeeks(new Date(`${weeks[0]}T00:00:00Z`), -step)));
  });
  const nextHref = hrefWith((params) => {
    params.set("start", toISODate(addWeeks(new Date(`${weeks[0]}T00:00:00Z`), step)));
  });

  function cellKey(wsId: string, week: string) {
    return `${wsId}:${week}`;
  }

  function groupWeekTasks(group: ProjectGroup, week: string) {
    return unionTasks(
      group.workstreams.map((row) => overrides[cellKey(row.id, week)] ?? row.tasksByWeek[week] ?? []),
    );
  }

  function cellTasks(wsId: string, week: string) {
    return (
      overridesRef.current[cellKey(wsId, week)] ??
      rowsRef.current.find((row) => row.id === wsId)?.tasksByWeek[week] ??
      []
    );
  }

  function rowStages(row: TimelineRow) {
    const seen = new Map<string, TimelineTask>();
    const weekSet = new Set([...Object.keys(row.tasksByWeek), ...visibleWeeks]);
    for (const week of weekSet) {
      const list = overrides[cellKey(row.id, week)] ?? row.tasksByWeek[week] ?? [];
      for (const task of list) seen.set(task.id, task);
    }
    return [...seen.values()];
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
    setEditorPos(null);
    hideTip();
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

  function hideTip() {
    if (tipTimer.current) window.clearTimeout(tipTimer.current);
    tipTimer.current = null;
    setTip(null);
  }

  function scheduleTip(rowId: string, week: string, el: HTMLElement) {
    hideTip();
    if (open) return;
    tipTimer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      const place: "left" | "right" = window.innerWidth - r.right > 240 ? "right" : "left";
      setTip({
        rowId,
        week,
        top: r.top + r.height / 2,
        left: place === "right" ? r.right + 8 : r.left - 8,
        place,
      });
    }, 1000);
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
        setEditorPos(null);
        hideTip();
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

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const el = event.target as HTMLElement;
      if (el.closest("[data-tl-editor]") || el.closest("[data-tl-cell]")) return;
      setOpen(null);
      setEditorPos(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => () => hideTip(), []);

  const tipRow = tip ? viewRows.find((row) => row.id === tip.rowId) : null;
  const tipStages = tipRow ? rowStages(tipRow) : [];
  const tipWeekTasks = tipRow && tip ? (overrides[cellKey(tipRow.id, tip.week)] ?? tipRow.tasksByWeek[tip.week] ?? []) : [];
  const openTasks = open
    ? (overrides[cellKey(open.ws, open.week)] ??
      viewRows.find((row) => row.id === open.ws)?.tasksByWeek[open.week] ??
      [])
    : [];

  const vars = compact
    ? {
        "--tl-status": "2.5rem",
        "--tl-name": "10.5rem",
        "--tl-client": "6rem",
        "--tl-pm": "5rem",
      }
    : {
        "--tl-status": "2.75rem",
        "--tl-name": "16rem",
        "--tl-client": "8.5rem",
        "--tl-pm": "7rem",
      };

  return (
    <div ref={rootRef} className="w-full" style={vars as CSSProperties}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-muted">Proyectos</span>
        <button
          type="button"
          className="text-cyan hover:underline"
          onClick={() => persistCollapsed(new Set())}
        >
          Abrir todos
        </button>
        <span className="text-line">·</span>
        <button
          type="button"
          className="text-cyan hover:underline"
          onClick={() => persistCollapsed(new Set(groups.map((group) => group.projectId)))}
        >
          Cerrar todos
        </button>
      </div>
      <table className={`w-full table-fixed border-collapse text-sm ${compact ? "" : "min-w-[72rem]"}`}>
        <thead>
          <tr>
            <th
              className="sticky left-0 top-16 z-50 border-b border-line bg-white px-1 py-2.5 shadow-[1px_0_0_0_var(--line)]"
              style={{ width: "var(--tl-status)", maxWidth: "var(--tl-status)" }}
            >
              <TimelineColumnHeader
                label=""
                align="center"
                sortKey="status"
                currentSort={currentSort}
                onSort={setSort}
                options={statusOptions}
                selected={statusFilter}
                onFilter={(values) => setFilter("st", values)}
              />
            </th>
            <th
              className="sticky top-16 z-50 border-b border-line bg-white px-2 py-2.5 shadow-[1px_0_0_0_var(--line)]"
              style={{
                left: "var(--tl-status)",
                width: "var(--tl-name)",
                maxWidth: "var(--tl-name)",
              }}
            >
              <TimelineColumnHeader
                label="Nombre"
                sortKey="name"
                currentSort={currentSort}
                onSort={setSort}
                options={nameOptions}
                selected={nameFilter}
                onFilter={(values) => setFilter("ws", values)}
              />
            </th>
            <th
              className="sticky top-16 z-50 border-b border-line bg-white px-2 py-2.5 shadow-[1px_0_0_0_var(--line)]"
              style={{
                left: "calc(var(--tl-status) + var(--tl-name))",
                width: "var(--tl-client)",
                maxWidth: "var(--tl-client)",
              }}
            >
              <TimelineColumnHeader
                label="Cliente"
                sortKey="client"
                currentSort={currentSort}
                onSort={setSort}
                options={clientOptions}
                selected={clientFilter}
                onFilter={(values) => setFilter("cl", values)}
              />
            </th>
            <th
              className="sticky top-16 z-50 border-b border-line bg-white px-2 py-2.5 shadow-[1px_0_0_0_var(--line)]"
              style={{
                left: "calc(var(--tl-status) + var(--tl-name) + var(--tl-client))",
                width: "var(--tl-pm)",
                maxWidth: "var(--tl-pm)",
              }}
            >
              <TimelineColumnHeader
                label="PMs"
                sortKey="pm"
                currentSort={currentSort}
                onSort={setSort}
                options={pmOptions}
                selected={pmFilter}
                onFilter={(values) => setFilter("pm", values)}
              />
            </th>
            <th className="sticky top-16 z-40 w-8 border-b border-line bg-white p-0">
              <span className="invisible">
                <AngleIcon direction="left" />
              </span>
              <Link href={prevHref} scroll={false} onClick={rememberScroll} className="absolute inset-0 flex items-center justify-center text-navy hover:text-cyan" aria-label="Semanas anteriores">
                <AngleIcon direction="left" />
              </Link>
            </th>
            {visibleWeeks.map((week) => {
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
            <th className="sticky top-16 z-40 w-8 border-b border-line bg-white p-0">
              <span className="invisible">
                <AngleIcon direction="right" />
              </span>
              <Link href={nextHref} scroll={false} onClick={rememberScroll} className="absolute inset-0 flex items-center justify-center text-navy hover:text-cyan" aria-label="Semanas siguientes">
                <AngleIcon direction="right" />
              </Link>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={visibleWeeks.length + 6} className="px-4 py-8 text-muted">
                No hay workstreams con esos filtros.
              </td>
            </tr>
          ) : (
            groups.flatMap((group) => {
              const openGroup = !collapsed.has(group.projectId);
              const header = (
                <tr key={`p-${group.projectId}`} className="border-t border-line bg-canvas">
                  <td
                    className="sticky left-0 z-10 overflow-hidden bg-canvas px-1 py-2 text-center shadow-[1px_0_0_0_var(--line)]"
                    style={{ width: "var(--tl-status)", maxWidth: "var(--tl-status)" }}
                  >
                    <StatusGlyph status={group.projectStatus} />
                  </td>
                  <td
                    className="sticky z-10 max-w-0 overflow-hidden bg-canvas px-2 py-2 shadow-[1px_0_0_0_var(--line)]"
                    style={{
                      left: "var(--tl-status)",
                      width: "var(--tl-name)",
                      maxWidth: "var(--tl-name)",
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={openGroup}
                      onClick={() => toggleCollapsed(group.projectId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleCollapsed(group.projectId);
                        }
                      }}
                      className="flex w-full min-w-0 cursor-pointer items-start gap-1.5 text-left"
                    >
                      <AngleIcon
                        direction={openGroup ? "down" : "right"}
                        className="mt-1 text-muted"
                      />
                      <span className="min-w-0 flex-1">
                        <MarqueeText
                          text={group.clientName || EMPTY}
                          className="text-base font-medium text-ink"
                        />
                        <div className="truncate text-muted">
                          {group.projectCode ? `${group.projectCode} · ` : ""}
                          {group.workstreams.length}{" "}
                          {group.workstreams.length === 1 ? "workstream" : "workstreams"}
                        </div>
                      </span>
                    </div>
                  </td>
                  <td
                    className="sticky z-10 max-w-0 overflow-hidden bg-canvas px-2 py-2 shadow-[1px_0_0_0_var(--line)]"
                    style={{
                      left: "calc(var(--tl-status) + var(--tl-name))",
                      width: "var(--tl-client)",
                      maxWidth: "var(--tl-client)",
                    }}
                  >
                    <MarqueeText text={group.clientName || EMPTY} className="text-navy" />
                  </td>
                  <td
                    className="sticky z-10 max-w-0 overflow-hidden bg-canvas px-2 py-2 shadow-[1px_0_0_0_var(--line)]"
                    style={{
                      left: "calc(var(--tl-status) + var(--tl-name) + var(--tl-client))",
                      width: "var(--tl-pm)",
                      maxWidth: "var(--tl-pm)",
                    }}
                  >
                    <MarqueeText text={group.pms.join(", ") || EMPTY} className="text-navy" />
                  </td>
                  <td className="bg-canvas" />
                  {visibleWeeks.map((week) => {
                    const current = week === thisWeek;
                    const summary = openGroup ? [] : groupWeekTasks(group, week);
                    return (
                      <td
                        key={week}
                        className={`bg-canvas px-0.5 py-1 align-top ${current ? "bg-cyan/5" : ""}`}
                      >
                        {openGroup ? (
                          <div className="min-h-8" />
                        ) : (
                          <div className="flex min-h-10 min-w-0 flex-col gap-0.5 px-1 py-1">
                            {summary.length === 0 ? (
                              <span className="text-line">·</span>
                            ) : (
                              summary.map((task) => (
                                <span
                                  key={task.id}
                                  className="truncate rounded-md px-1 py-0.5 text-xs text-white"
                                  style={{ background: task.color }}
                                >
                                  {task.name}
                                </span>
                              ))
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="bg-canvas" />
                </tr>
              );
              if (!openGroup) return [header];
              return [
                header,
                ...group.workstreams.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td
                      className="sticky left-0 z-10 overflow-hidden bg-white px-1 py-2 text-center shadow-[1px_0_0_0_var(--line)]"
                      style={{ width: "var(--tl-status)", maxWidth: "var(--tl-status)" }}
                    >
                      <StatusGlyph status={row.status} />
                    </td>
                    <td
                      className="sticky z-10 max-w-0 overflow-hidden bg-white px-2 py-2 shadow-[1px_0_0_0_var(--line)]"
                      style={{
                        left: "var(--tl-status)",
                        width: "var(--tl-name)",
                        maxWidth: "var(--tl-name)",
                      }}
                    >
                      <div className="ml-3 border-l-2 border-line pl-5">
                        <MarqueeText
                          href={`/workstreams/${row.id}`}
                          text={row.name}
                          className="text-base font-medium text-ink hover:text-cyan"
                        />
                      </div>
                    </td>
                    <td
                      className="sticky z-10 max-w-0 overflow-hidden bg-white px-2 py-2 shadow-[1px_0_0_0_var(--line)]"
                      style={{
                        left: "calc(var(--tl-status) + var(--tl-name))",
                        width: "var(--tl-client)",
                        maxWidth: "var(--tl-client)",
                      }}
                    >
                      <MarqueeText text={row.clientName || EMPTY} className="text-navy" />
                    </td>
                    <td
                      className="sticky z-10 max-w-0 overflow-hidden bg-white px-2 py-2 shadow-[1px_0_0_0_var(--line)]"
                      style={{
                        left: "calc(var(--tl-status) + var(--tl-name) + var(--tl-client))",
                        width: "var(--tl-pm)",
                        maxWidth: "var(--tl-pm)",
                      }}
                    >
                      <MarqueeText text={row.pms.join(", ") || EMPTY} className="text-navy" />
                    </td>
                    <td />
                    {visibleWeeks.map((week) => {
                      const cellList = overrides[cellKey(row.id, week)] ?? row.tasksByWeek[week] ?? [];
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
                            onMouseEnter={(event) => scheduleTip(row.id, week, event.currentTarget)}
                            onMouseLeave={hideTip}
                            onClick={(event) => {
                              hideTip();
                              setSelected({ ws: row.id, week });
                              if (!canWrite) return;
                              if (isOpen) {
                                setOpen(null);
                                setEditorPos(null);
                                return;
                              }
                              const r = event.currentTarget.getBoundingClientRect();
                              const left = window.innerWidth - r.left < 220 ? Math.max(8, r.right - 208) : r.left;
                              setEditorPos({ top: r.bottom + 4, left });
                              setOpen({ ws: row.id, week });
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
                            {cellList.length === 0 ? (
                              <span className="text-line">·</span>
                            ) : (
                              cellList.map((task) => (
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
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                )),
              ];
            })
          )}
        </tbody>
      </table>
      {tip && tipRow
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[110] max-w-xs rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink"
              style={{
                top: tip.top,
                left: tip.left,
                transform: tip.place === "right" ? "translateY(-50%)" : "translate(-100%, -50%)",
              }}
            >
              <div className="font-medium">{tipRow.name}</div>
              {tipWeekTasks.length ? (
                <ul className="mt-1 space-y-0.5">
                  {tipWeekTasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: task.color }} />
                      {task.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-muted">Sin etapas esta semana</div>
              )}
              {tipStages.length && tipStages.length !== tipWeekTasks.length ? (
                <div className="mt-2 border-t border-line pt-2">
                  <div className="text-muted">Activas en el proyecto</div>
                  <ul className="mt-1 space-y-0.5">
                    {tipStages.map((task) => (
                      <li key={task.id} className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: task.color }} />
                        {task.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
      {open && editorPos
        ? createPortal(
            <div
              data-tl-editor
              className="fixed z-[120] max-h-56 w-52 overflow-auto rounded-2xl border border-line bg-white p-3"
              style={{ top: editorPos.top, left: editorPos.left }}
            >
              {tasks.map((task) => {
                const checked = openTasks.some((t) => t.id === task.id);
                return (
                  <label key={task.id} className="flex items-center gap-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(open.ws, open.week, openTasks, task.id)}
                    />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: task.color }} />
                    <span className="text-navy">{task.name}</span>
                  </label>
                );
              })}
              <div className="pt-2 text-muted">{openTasks.length} seleccionadas</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
