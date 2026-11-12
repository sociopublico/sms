"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  addWeeks,
  formatMonthLabel,
  formatWeekLabel,
  fullMonthIds,
  isCurrentMonth,
  mondaysOfMonth,
  STATUS_LABEL,
  TIMELINE_VISIBLE_WEEKS,
  TIMELINE_WEEK_BUFFER,
  toISODate,
  weekRange,
} from "@/lib/dates";
import { fetchTasksByWeek, mergeWeekMaps } from "@/lib/timeline-weeks";
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
  projectName: string;
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
const VISIBLE_MONTHS = 6;
const COMPACT_MONTHS = 4;
const WIDE_WEEKS = 18;
const WIDE_MONTHS = 8;
const DENSITY_KEY = "timeline-density";
const SCROLL_Y_KEY = "timeline-scroll-y";
const KEEP_SCROLL_KEY = "timeline-keep-scroll";
const COLLAPSED_KEY = "timeline-collapsed-projects";

type TimelineDensity = "normal" | "wide";

function loadDensity(): TimelineDensity {
  if (typeof window === "undefined") return "normal";
  return window.sessionStorage.getItem(DENSITY_KEY) === "wide" ? "wide" : "normal";
}

type TimelineMode = "week" | "month";
type TimelineCol = {
  id: string;
  weeks: string[];
  label: string;
  current: boolean;
  tint: boolean;
};

function buildColumns(weeks: string[], mode: TimelineMode, thisWeek: string): TimelineCol[] {
  if (mode === "week") {
    return weeks.map((week) => ({
      id: week,
      weeks: [week],
      label: formatWeekLabel(week),
      current: week === thisWeek,
      tint: isCurrentMonth(week),
    }));
  }
  const thisMonth = thisWeek.slice(0, 7);
  return fullMonthIds(weeks).map((id) => {
    const [year, month] = id.split("-").map(Number);
    return {
      id,
      weeks: mondaysOfMonth(year, month),
      label: formatMonthLabel(id),
      current: id === thisMonth,
      tint: false,
    };
  });
}

function columnIds(weeks: string[], mode: TimelineMode) {
  return mode === "month" ? fullMonthIds(weeks) : weeks;
}

function countSpan(weeks: string[], lists: TimelineTask[][]) {
  const counts = new Map<string, { task: TimelineTask; seen: Set<string> }>();
  weeks.forEach((week, index) => {
    for (const task of lists[index] ?? []) {
      const hit = counts.get(task.id);
      if (hit) hit.seen.add(week);
      else counts.set(task.id, { task, seen: new Set([week]) });
    }
  });
  return [...counts.values()].map(({ task, seen }) => ({ task, count: seen.size }));
}

function relativeLuminance(color: string) {
  const hex = color.trim().replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a: number, b: number) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function contrastText(color: string) {
  const bg = relativeLuminance(color);
  const ink = relativeLuminance("#16222f");
  const white = 1;
  return contrastRatio(ink, bg) >= contrastRatio(white, bg) ? "#16222f" : "#ffffff";
}

function TaskPills({ items }: { items: { task: TimelineTask; count: number }[] }) {
  if (items.length === 0) return <span className="text-line">·</span>;
  return items.map(({ task, count }) => {
    const textColor = contrastText(task.color);
    return (
      <span
        key={task.id}
        title={count > 1 ? `${task.name} · ${count} semanas` : task.name}
        className="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs"
        style={{ background: task.color, color: textColor }}
      >
        <span className="min-w-0 truncate">{task.name}</span>
        {count > 1 ? (
          <span
            className="shrink-0 rounded px-1 font-medium tabular-nums"
            style={{ background: textColor === "#ffffff" ? "rgba(0,0,0,0.2)" : "rgba(22,34,47,0.12)" }}
          >
            +{count - 1}
          </span>
        ) : null}
      </span>
    );
  });
}

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

function indexTasks(rows: TimelineRow[]) {
  const map: Record<string, Record<string, TimelineTask[]>> = {};
  for (const row of rows) map[row.id] = row.tasksByWeek;
  return map;
}

type ProjectGroup = {
  projectId: string;
  projectCode: string;
  projectName: string;
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
  windowStart,
  rows,
  tasks,
  canWrite,
  thisWeek,
}: {
  weeks: string[];
  windowStart: string;
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
  const [density, setDensity] = useState<TimelineDensity>(loadDensity);
  const [open, setOpen] = useState<{ ws: string; week: string } | null>(null);
  const [editorPos, setEditorPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);
  const [selected, setSelected] = useState<{ ws: string; week: string } | null>(null);
  const [copied, setCopied] = useState<{ ws: string; week: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, TimelineTask[]>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const [range, setRange] = useState(weeks);
  const [cursor, setCursor] = useState(windowStart);
  const [mode, setMode] = useState<TimelineMode>(searchParams.get("view") === "month" ? "month" : "week");
  const [shown, setShown] = useState<TimelineMode>(mode);
  const [monthCursor, setMonthCursor] = useState(windowStart.slice(0, 7));
  const [modeFx, setModeFx] = useState<"idle" | "out" | "in">("idle");
  const [weekMap, setWeekMap] = useState(() => indexTasks(rows));
  const [slide, setSlide] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [snap, setSnap] = useState(false);
  const serverKey = `${windowStart}|${weeks[0] ?? ""}|${weeks[weeks.length - 1] ?? ""}|${rows.map((row) => row.id).join(",")}`;
  const [syncedKey, setSyncedKey] = useState(serverKey);
  if (syncedKey !== serverKey) {
    setSyncedKey(serverKey);
    setRange(weeks);
    setCursor(windowStart);
    setMonthCursor(windowStart.slice(0, 7));
    setWeekMap(indexTasks(rows));
    setOverrides({});
    setSlide(0);
    setAnimating(false);
    setSnap(true);
  }
  const [tip, setTip] = useState<{
    rowId: string;
    week: string;
    top: number;
    left: number;
    place: "left" | "right";
    vPlace: "center" | "above" | "below";
  } | null>(null);
  const [, startTransition] = useTransition();
  const clipRef = useRef<string[]>([]);
  const selectedRef = useRef(selected);
  const rowsRef = useRef(rows);
  const weeksRef = useRef(weeks);
  const overridesRef = useRef(overrides);
  const weekMapRef = useRef(weekMap);
  const rangeRef = useRef(range);
  const cursorRef = useRef(cursor);
  const extendLocks = useRef({ prev: false, next: false });
  const animatingRef = useRef(false);
  const slideDirRef = useRef<1 | -1>(1);
  const tipTimer = useRef<number | null>(null);
  const viewRef = useRef(mode);
  const shownRef = useRef(shown);
  const monthCursorRef = useRef(monthCursor);
  const weekAnchorRef = useRef(windowStart);
  const fxRef = useRef(modeFx);
  const visibleCountRef = useRef(TIMELINE_VISIBLE_WEEKS);
  const modeTimer = useRef<number | null>(null);

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

  const visibleCount =
    shown === "month"
      ? compact
        ? COMPACT_MONTHS
        : density === "wide"
          ? WIDE_MONTHS
          : VISIBLE_MONTHS
      : compact
        ? COMPACT_WEEKS
        : density === "wide"
          ? WIDE_WEEKS
          : TIMELINE_VISIBLE_WEEKS;

  function persistDensity(next: TimelineDensity) {
    setDensity(next);
    sessionStorage.setItem(DENSITY_KEY, next);
  }
  const columns = useMemo(() => buildColumns(range, shown, thisWeek), [range, shown, thisWeek]);
  const activeId = shown === "week" ? cursor : monthCursor;
  let cursorIndex = columns.findIndex((col) => col.id === activeId);
  if (cursorIndex < 0) {
    cursorIndex = columns.findIndex((col) => col.id >= activeId);
    if (cursorIndex < 0) cursorIndex = Math.max(columns.length - 1, 0);
  }
  const visibleCols = columns.slice(cursorIndex, cursorIndex + visibleCount);
  const visibleWeeks = visibleCols.flatMap((col) => col.weeks);
  const sliceStart = Math.max(0, cursorIndex - 1);
  const sliceEnd = Math.min(columns.length, cursorIndex + visibleCount + 1);
  const trackCols = columns.slice(sliceStart, sliceEnd);
  const offsetCols = cursorIndex - sliceStart + slide;
  const trackStyle: CSSProperties | undefined = trackCols.length
    ? {
        width: `${(trackCols.length / visibleCount) * 100}%`,
        transform: `translateX(-${(offsetCols * 100) / trackCols.length}%)`,
      }
    : undefined;
  const colWidth = `${100 / Math.max(trackCols.length, 1)}%`;
  const trackClass = `tl-week-track flex h-full items-stretch ${snap ? "tl-week-snap" : ""}`;
  const fxClass = modeFx === "out" ? "tl-cols-out" : modeFx === "in" ? "tl-cols-in" : "";

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

  async function extendRange(dir: -1 | 1) {
    const key = dir < 0 ? "prev" : "next";
    if (extendLocks.current[key]) return;
    extendLocks.current[key] = true;
    try {
      const current = rangeRef.current;
      if (!current.length) return;
      const count = TIMELINE_WEEK_BUFFER;
      const extra =
        dir < 0
          ? weekRange(toISODate(addWeeks(new Date(`${current[0]}T00:00:00Z`), -count)), count)
          : weekRange(toISODate(addWeeks(new Date(`${current[current.length - 1]}T00:00:00Z`), 1)), count);
      const fetched = await fetchTasksByWeek(extra);
      setWeekMap((prev) => {
        const next = mergeWeekMaps(prev, fetched);
        weekMapRef.current = next;
        return next;
      });
      if (!animatingRef.current) setSnap(true);
      setRange((prev) => {
        const have = new Set(prev);
        const novel = extra.filter((week) => !have.has(week));
        const next = novel.length === 0 ? prev : dir < 0 ? [...novel, ...prev] : [...prev, ...novel];
        rangeRef.current = next;
        return next;
      });
    } catch {
      // Si falla la precarga, el próximo movimiento lo reintenta.
    } finally {
      extendLocks.current[key] = false;
    }
  }

  function replaceUrl(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(window.location.search);
    mutate(params);
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    const state = window.history.state as { __NA?: unknown; _N?: unknown } | null;
    if (state?.__NA || state?._N) window.history.replaceState(state, "", url);
  }

  function applyCursor(next: string) {
    cursorRef.current = next;
    setCursor(next);
    replaceUrl((params) => {
      params.set("start", next);
      if (viewRef.current === "month") params.set("view", "month");
      else params.delete("view");
    });
  }

  function applyColumn(id: string) {
    if (shownRef.current === "month") {
      monthCursorRef.current = id;
      setMonthCursor(id);
      const first = rangeRef.current.find((week) => week.startsWith(id));
      if (first) applyCursor(first);
      return;
    }
    applyCursor(id);
  }

  function beginSlide(dir: 1 | -1) {
    if (animatingRef.current || fxRef.current !== "idle") return;
    const list = columnIds(rangeRef.current, shownRef.current);
    const count = visibleCountRef.current;
    const index = list.indexOf(shownRef.current === "month" ? monthCursorRef.current : cursorRef.current);
    if (index < 0) return;
    const next = list[index + dir];
    const entering = list[dir > 0 ? index + count : index - 1];
    if (!next || !entering) {
      void extendRange(dir).then(() => {
        if (fxRef.current !== "idle") return;
        const again = columnIds(rangeRef.current, shownRef.current);
        const at = again.indexOf(shownRef.current === "month" ? monthCursorRef.current : cursorRef.current);
        const againCount = visibleCountRef.current;
        if (again[at + dir] && again[dir > 0 ? at + againCount : at - 1]) beginSlide(dir);
      });
      return;
    }
    const buffer = shownRef.current === "month" ? 3 : 12;
    const remainingBefore = index + dir;
    const remainingAfter = list.length - (remainingBefore + count);
    if (dir < 0 && remainingBefore < buffer) void extendRange(-1);
    if (dir > 0 && remainingAfter < buffer) void extendRange(1);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyColumn(next);
      return;
    }
    slideDirRef.current = dir;
    animatingRef.current = true;
    setSlide(dir);
    setAnimating(true);
  }

  function finishSlide(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    if (!animatingRef.current) return;
    const dir = slideDirRef.current;
    animatingRef.current = false;
    const list = columnIds(rangeRef.current, shownRef.current);
    const index = list.indexOf(shownRef.current === "month" ? monthCursorRef.current : cursorRef.current);
    const next = list[index + dir];
    setSnap(true);
    setAnimating(false);
    setSlide(0);
    if (next) applyColumn(next);
  }

  function alignMode(next: TimelineMode) {
    setSelected(null);
    setOpen(null);
    setEditorPos(null);
    setCopied(null);
    hideTip();
    if (next === "month") {
      weekAnchorRef.current = cursorRef.current;
      const key = cursorRef.current.slice(0, 7);
      const ids = fullMonthIds(rangeRef.current);
      const pick = ids.includes(key) ? key : (ids.find((id) => id >= key) ?? ids[ids.length - 1]);
      if (pick) {
        monthCursorRef.current = pick;
        setMonthCursor(pick);
      }
      return;
    }
    const anchor = weekAnchorRef.current;
    if (anchor.startsWith(monthCursorRef.current)) {
      applyCursor(anchor);
      return;
    }
    const inMonth = rangeRef.current.filter((week) => week.startsWith(monthCursorRef.current));
    const pick = inMonth.includes(thisWeek) ? thisWeek : inMonth[0];
    if (pick) applyCursor(pick);
  }

  function switchMode(next: TimelineMode) {
    if (next === mode && fxRef.current === "idle") return;
    if (modeTimer.current) window.clearTimeout(modeTimer.current);
    animatingRef.current = false;
    setAnimating(false);
    setSlide(0);
    setSnap(true);
    hideTip();
    setMode(next);
    viewRef.current = next;
    replaceUrl((params) => {
      if (next === "month") params.set("view", "month");
      else params.delete("view");
    });
    const commit = () => {
      if (next !== shownRef.current) alignMode(next);
      shownRef.current = next;
      setShown(next);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commit();
      fxRef.current = "idle";
      setModeFx("idle");
      return;
    }
    fxRef.current = "out";
    setModeFx("out");
    modeTimer.current = window.setTimeout(() => {
      commit();
      fxRef.current = "in";
      setModeFx("in");
      modeTimer.current = window.setTimeout(() => {
        fxRef.current = "idle";
        setModeFx("idle");
      }, 340);
    }, 230);
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
          projectName: row.projectName,
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
    () =>
      groups.flatMap((group) =>
        group.workstreams.length === 1 || !collapsed.has(group.projectId) ? group.workstreams : [],
      ),
    [groups, collapsed],
  );

  useLayoutEffect(() => {
    selectedRef.current = selected;
    overridesRef.current = overrides;
    weeksRef.current = visibleCols.map((col) => col.id);
    rowsRef.current = visibleWorkstreams;
    weekMapRef.current = weekMap;
    rangeRef.current = range;
    cursorRef.current = cursor;
    animatingRef.current = animating;
    viewRef.current = mode;
    shownRef.current = shown;
    monthCursorRef.current = monthCursor;
    fxRef.current = modeFx;
    visibleCountRef.current = visibleCount;
    if (shown === "month" && columns.length > 0 && !columns.some((col) => col.id === monthCursor)) {
      const next = columns.find((col) => col.id >= monthCursor)?.id ?? columns[columns.length - 1].id;
      monthCursorRef.current = next;
      setMonthCursor(next);
    }
  });

  useLayoutEffect(() => {
    if (!snap) return;
    const id = requestAnimationFrame(() => setSnap(false));
    return () => cancelAnimationFrame(id);
  }, [snap]);

  function hrefWith(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("start", cursorRef.current);
    if (viewRef.current === "month") params.set("view", "month");
    else params.delete("view");
    mutate(params);
    const q = params.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    rememberScroll();
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

  function cellKey(wsId: string, week: string) {
    return `${wsId}:${week}`;
  }

  function lookupTasks(wsId: string, week: string) {
    return overrides[cellKey(wsId, week)] ?? weekMap[wsId]?.[week] ?? [];
  }

  function spanTasks(wsId: string, span: string[]) {
    return countSpan(
      span,
      span.map((week) => lookupTasks(wsId, week)),
    );
  }

  function groupSpanTasks(group: ProjectGroup, span: string[]) {
    return countSpan(
      span,
      span.map((week) => unionTasks(group.workstreams.map((row) => lookupTasks(row.id, week)))),
    );
  }

  function cellTasks(wsId: string, week: string) {
    return overridesRef.current[cellKey(wsId, week)] ?? weekMapRef.current[wsId]?.[week] ?? [];
  }

  function rowStages(row: TimelineRow) {
    const seen = new Map<string, TimelineTask>();
    const byWeek = weekMap[row.id] ?? {};
    const weekSet = new Set([...Object.keys(byWeek), ...visibleWeeks]);
    for (const week of weekSet) {
      const list = overrides[cellKey(row.id, week)] ?? byWeek[week] ?? [];
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
    const [spanYear, spanMonth] = cell.week.split("-").map(Number);
    const span = cell.week.length === 7 ? mondaysOfMonth(spanYear, spanMonth) : [cell.week];
    const ids = [...new Set(span.flatMap((week) => cellTasks(cell.ws, week).map((task) => task.id)))];
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
    if (!cell || !canWrite || shownRef.current !== "week") return;
    const ids = clipRef.current;
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
    if (!cell || !canWrite || shownRef.current !== "week") return;
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
      const tipH = 180;
      const midY = r.top + r.height / 2;
      let vPlace: "center" | "above" | "below" = "center";
      let top = midY;
      if (midY + tipH / 2 > window.innerHeight - 8) {
        vPlace = "above";
        top = r.top - 8;
      } else if (midY - tipH / 2 < 8) {
        vPlace = "below";
        top = r.bottom + 8;
      }
      setTip({
        rowId,
        week,
        top,
        left: place === "right" ? r.right + 8 : r.left - 8,
        place,
        vPlace,
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
        if ((event.key === "v" || event.key === "V") && canWrite && shownRef.current === "week") {
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

  useEffect(
    () => () => {
      hideTip();
      if (modeTimer.current) window.clearTimeout(modeTimer.current);
    },
    [],
  );

  const tipRow = tip ? viewRows.find((row) => row.id === tip.rowId) : null;
  const tipStages = tipRow ? rowStages(tipRow) : [];
  const tipCol = tip ? columns.find((col) => col.id === tip.week) : null;
  const tipItems = tipRow && tipCol ? spanTasks(tipRow.id, tipCol.weeks) : [];
  const openTasks = open ? lookupTasks(open.ws, open.week) : [];

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
          onClick={() =>
            persistCollapsed(
              new Set(groups.filter((group) => group.workstreams.length > 1).map((group) => group.projectId)),
            )
          }
        >
          Cerrar todos
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!compact ? (
            <button
              type="button"
              aria-pressed={density === "wide"}
              onClick={() => persistDensity(density === "wide" ? "normal" : "wide")}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                density === "wide"
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-paper text-muted hover:text-navy"
              }`}
              title={density === "wide" ? "Volver a 12 semanas / 6 meses" : "Ver más columnas"}
            >
              Más columnas
            </button>
          ) : null}
          <div role="group" aria-label="Vista del timeline" className="relative grid grid-cols-2 rounded-full border border-line bg-paper p-0.5 text-sm font-medium">
          <span
            aria-hidden
            className="absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-0.125rem)] rounded-full bg-navy transition-transform duration-300 ease-[cubic-bezier(0.22,0.8,0.3,1)]"
            style={{ transform: mode === "month" ? "translateX(100%)" : "translateX(0)" }}
          />
          <button
            type="button"
            aria-pressed={mode === "week"}
            onClick={() => switchMode("week")}
            className={`relative z-10 rounded-full px-3 py-1 transition-colors duration-300 ${mode === "week" ? "text-white" : "text-muted hover:text-navy"}`}
          >
            Semana
          </button>
          <button
            type="button"
            aria-pressed={mode === "month"}
            onClick={() => switchMode("month")}
            className={`relative z-10 rounded-full px-3 py-1 transition-colors duration-300 ${mode === "month" ? "text-white" : "text-muted hover:text-navy"}`}
          >
            Mes
          </button>
          </div>
        </div>
      </div>
      <div className="-mx-1 overflow-x-auto">
      <table className={`w-full table-fixed border-collapse text-sm ${compact ? "" : "min-w-[72rem]"}`}>
        <thead>
          <tr>
            <th
              className="sticky left-0 top-16 z-50 border-b border-line bg-paper px-1 py-2.5 shadow-[1px_0_0_0_var(--line)]"
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
              className="sticky top-16 z-50 border-b border-line bg-paper px-2 py-2.5 shadow-[1px_0_0_0_var(--line)]"
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
              className="sticky top-16 z-50 border-b border-line bg-paper px-2 py-2.5 shadow-[1px_0_0_0_var(--line)]"
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
              className="sticky top-16 z-50 border-b border-line bg-paper px-2 py-2.5 shadow-[1px_0_0_0_var(--line)]"
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
            <th className="sticky top-16 z-40 w-8 border-b border-line bg-paper p-0">
              <span className="invisible">
                <AngleIcon direction="left" />
              </span>
              <button type="button" onClick={() => beginSlide(-1)} className="absolute inset-0 flex items-center justify-center text-navy hover:text-cyan" aria-label={shown === "month" ? "Mes anterior" : "Semana anterior"}>
                <AngleIcon direction="left" />
              </button>
            </th>
            <th className="sticky top-16 z-40 border-b border-line bg-paper p-0">
              <div className="invisible flex flex-col items-center px-1 py-2.5 font-medium" aria-hidden>
                00/00
                <div className="text-xs font-normal">hoy</div>
              </div>
              <div className="absolute inset-0 overflow-hidden">
                <div className={`h-full ${fxClass}`}>
                  <div className={trackClass} style={trackStyle} onTransitionEnd={finishSlide}>
                    {trackCols.map((col) => (
                      <div
                        key={col.id}
                        className={`flex h-full min-w-0 shrink-0 flex-col items-center justify-center px-1 text-center font-medium capitalize ${
                          col.current ? "bg-[#d9eef6] text-cyan" : col.tint ? "bg-canvas text-ink" : "bg-paper text-muted"
                        }`}
                        style={{ width: colWidth }}
                      >
                        {col.label}
                        {col.current ? <div className="text-xs font-normal normal-case">hoy</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </th>
            <th className="sticky top-16 z-40 w-8 border-b border-line bg-paper p-0">
              <span className="invisible">
                <AngleIcon direction="right" />
              </span>
              <button type="button" onClick={() => beginSlide(1)} className="absolute inset-0 flex items-center justify-center text-navy hover:text-cyan" aria-label={shown === "month" ? "Mes siguiente" : "Semana siguiente"}>
                <AngleIcon direction="right" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-muted">
                No hay workstreams con esos filtros.
              </td>
            </tr>
          ) : (
            groups.flatMap((group) => {
              const solo = group.workstreams.length === 1;
              const openGroup = solo || !collapsed.has(group.projectId);
              const header = solo ? null : (
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
                    <div className="flex w-full min-w-0 items-start gap-1.5 text-left">
                      <button
                        type="button"
                        aria-expanded={openGroup}
                        aria-label={`${openGroup ? "Cerrar" : "Abrir"} ${group.clientName || "proyecto"}`}
                        onClick={() => toggleCollapsed(group.projectId)}
                        className="mt-1 shrink-0 text-muted hover:text-navy"
                      >
                        <AngleIcon direction={openGroup ? "down" : "right"} />
                      </button>
                      <span className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleCollapsed(group.projectId)}
                          className="block w-full min-w-0 text-left"
                        >
                          <MarqueeText
                            text={group.clientName || EMPTY}
                            className="text-base font-medium text-ink"
                          />
                        </button>
                        <div className="truncate text-muted">
                          {group.projectCode || group.projectName ? (
                            <>
                              <a
                                href={`/proyectos/${group.projectId}`}
                                className="hover:text-cyan hover:underline"
                              >
                                {group.projectName || group.projectCode}
                              </a>
                              {group.projectName && group.projectCode ? (
                                <span className="text-muted"> · {group.projectCode}</span>
                              ) : null}
                              {" · "}
                            </>
                          ) : null}
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
                  <td className="bg-canvas p-0 align-top">
                    <div className="overflow-hidden">
                      <div className={fxClass}>
                        <div className={trackClass} style={trackStyle}>
                          {trackCols.map((col) => {
                            const summary = openGroup ? [] : groupSpanTasks(group, col.weeks);
                            return (
                              <div
                                key={col.id}
                                className={`flex min-w-0 shrink-0 flex-col px-0.5 py-1 ${col.current ? "bg-cyan/5" : ""}`}
                                style={{ width: colWidth }}
                              >
                                {openGroup ? (
                                  <div className="min-h-8" />
                                ) : (
                                  <div className="flex min-h-10 min-w-0 flex-1 flex-col gap-0.5 px-1 py-1">
                                    <TaskPills items={summary} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="bg-canvas" />
                </tr>
              );
              const body = openGroup
                ? group.workstreams.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td
                      className="sticky left-0 z-10 overflow-hidden bg-paper px-1 py-2 text-center shadow-[1px_0_0_0_var(--line)]"
                      style={{ width: "var(--tl-status)", maxWidth: "var(--tl-status)" }}
                    >
                      <StatusGlyph status={row.status} />
                    </td>
                    <td
                      className="sticky z-10 max-w-0 overflow-hidden bg-paper px-2 py-2 shadow-[1px_0_0_0_var(--line)]"
                      style={{
                        left: "var(--tl-status)",
                        width: "var(--tl-name)",
                        maxWidth: "var(--tl-name)",
                      }}
                    >
                      <div className={solo ? "min-w-0" : "ml-3 border-l-2 border-line pl-5"}>
                        <MarqueeText
                          href={`/workstreams/${row.id}`}
                          text={row.name}
                          className="text-base font-medium text-ink hover:text-cyan"
                        />
                        {solo && (row.projectCode || row.projectName) ? (
                          <div className="truncate text-muted">
                            <a
                              href={`/proyectos/${row.projectId}`}
                              className="hover:text-cyan hover:underline"
                            >
                              {row.projectName || row.projectCode}
                            </a>
                            {row.projectName && row.projectCode ? (
                              <span> · {row.projectCode}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className="sticky z-10 max-w-0 overflow-hidden bg-paper px-2 py-2 shadow-[1px_0_0_0_var(--line)]"
                      style={{
                        left: "calc(var(--tl-status) + var(--tl-name))",
                        width: "var(--tl-client)",
                        maxWidth: "var(--tl-client)",
                      }}
                    >
                      <MarqueeText text={row.clientName || EMPTY} className="text-navy" />
                    </td>
                    <td
                      className="sticky z-10 max-w-0 overflow-hidden bg-paper px-2 py-2 shadow-[1px_0_0_0_var(--line)]"
                      style={{
                        left: "calc(var(--tl-status) + var(--tl-name) + var(--tl-client))",
                        width: "var(--tl-pm)",
                        maxWidth: "var(--tl-pm)",
                      }}
                    >
                      <MarqueeText text={row.pms.join(", ") || EMPTY} className="text-navy" />
                    </td>
                    <td />
                    <td className="p-0 align-top">
                      <div className="overflow-hidden">
                        <div className={fxClass}>
                          <div className={trackClass} style={trackStyle}>
                            {trackCols.map((col) => {
                              const cellList = spanTasks(row.id, col.weeks);
                              const isOpen = shown === "week" && open?.ws === row.id && open.week === col.id;
                              return (
                                <div
                                  key={col.id}
                                  className={`flex min-w-0 shrink-0 flex-col px-0.5 py-1 ${col.current ? "bg-cyan/5" : ""}`}
                                  style={{ width: colWidth }}
                                >
                                  <button
                                    type="button"
                                    data-tl-cell={`${row.id}::${col.id}`}
                                    onMouseEnter={(event) => scheduleTip(row.id, col.id, event.currentTarget)}
                                    onMouseLeave={hideTip}
                                    onClick={(event) => {
                                      hideTip();
                                      setSelected({ ws: row.id, week: col.id });
                                      if (shown !== "week" || !canWrite) return;
                                      if (isOpen) {
                                        setOpen(null);
                                        setEditorPos(null);
                                        return;
                                      }
                                      const r = event.currentTarget.getBoundingClientRect();
                                      const left = window.innerWidth - r.left < 220 ? Math.max(8, r.right - 208) : r.left;
                                      const spaceBelow = window.innerHeight - r.bottom - 8;
                                      const spaceAbove = r.top - 8;
                                      const editorH = 224;
                                      if (spaceBelow >= Math.min(editorH, 160) || spaceBelow >= spaceAbove) {
                                        setEditorPos({
                                          top: r.bottom + 4,
                                          left,
                                          maxHeight: Math.min(editorH, Math.max(120, spaceBelow)),
                                        });
                                      } else {
                                        setEditorPos({
                                          bottom: window.innerHeight - r.top + 4,
                                          left,
                                          maxHeight: Math.min(editorH, Math.max(120, spaceAbove)),
                                        });
                                      }
                                      setOpen({ ws: row.id, week: col.id });
                                    }}
                                    className={`flex h-full min-h-10 w-full min-w-0 flex-1 flex-col gap-0.5 rounded-lg border px-1 py-1 pb-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan ${
                                      isOpen || (selected?.ws === row.id && selected.week === col.id)
                                        ? copied?.ws === row.id && copied.week === col.id
                                          ? "border-dashed border-cyan"
                                          : "border-cyan"
                                        : copied?.ws === row.id && copied.week === col.id
                                          ? "border-dashed border-cyan/60"
                                          : "border-transparent hover:border-line"
                                    }`}
                                  >
                                    <TaskPills items={cellList} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td />
                  </tr>
                ))
                : [];
              if (!header) return body;
              if (!openGroup) return [header];
              return [header, ...body];
            })
          )}
        </tbody>
      </table>
      </div>
      {tip && tipRow
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[110] max-w-xs rounded-2xl border border-line bg-paper px-3 py-2 text-sm text-ink"
              style={{
                top: tip.top,
                left: tip.left,
                transform: [
                  tip.place === "right" ? "translateX(0)" : "translateX(-100%)",
                  tip.vPlace === "center" ? "translateY(-50%)" : tip.vPlace === "above" ? "translateY(-100%)" : "translateY(0)",
                ].join(" "),
              }}
            >
              <div className="font-medium">{tipRow.name}</div>
              {tipItems.length ? (
                <ul className="mt-1 space-y-0.5">
                  {tipItems.map(({ task, count }) => (
                    <li key={task.id} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: task.color }} />
                      <span className="min-w-0">{task.name}</span>
                      {shown === "month" ? (
                        <span className="shrink-0 text-muted">
                          {count} {count === 1 ? "semana" : "semanas"}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-muted">{shown === "month" ? "Sin etapas este mes" : "Sin etapas esta semana"}</div>
              )}
              {shown === "month" && canWrite ? (
                <div className="mt-2 text-muted">Para editar, pasá a la vista por semana.</div>
              ) : null}
              {shown === "week" && tipStages.length && tipStages.length !== tipItems.length ? (
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
              className="fixed z-[120] w-52 overflow-auto rounded-2xl border border-line bg-paper p-3"
              style={{
                top: editorPos.top,
                bottom: editorPos.bottom,
                left: editorPos.left,
                maxHeight: editorPos.maxHeight,
              }}
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
