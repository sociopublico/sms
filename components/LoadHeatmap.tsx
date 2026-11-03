"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { addWeeks, formatWeekLabel, isCurrentMonth, toISODate } from "@/lib/dates";
import { AngleIcon } from "@/components/ui/AngleIcon";

export type LoadCell = { person_id: string; week_start: string; load_count: number };
export type LoadDetail = {
  person_id: string;
  week_start: string;
  project_code: string;
  project_name: string;
  client_name: string;
  workstream_name: string;
  task_name: string;
  role_name: string;
};

const COMPACT_WEEKS = 6;
const SCROLL_Y_KEY = "workload-scroll-y";
const KEEP_SCROLL_KEY = "workload-keep-scroll";

function cellStyle(count: number) {
  if (count === 0) return { background: "transparent", color: undefined as string | undefined };
  const intensity = Math.min(count / 8, 1);
  return {
    background: `rgba(64, 153, 247, ${0.12 + intensity * 0.78})`,
    color: intensity > 0.45 ? "#fff" : "#16222F",
  };
}

function sliceWeeks(weeks: string[], thisWeek: string, count: number) {
  if (weeks.length <= count) return weeks;
  const i = weeks.indexOf(thisWeek);
  if (i < 0) return weeks.slice(0, count);
  const start = Math.min(Math.max(0, i - 2), weeks.length - count);
  return weeks.slice(start, start + count);
}

export function LoadHeatmap({
  people,
  weeks,
  cells,
  details,
  cyanDotIds,
  orangeDotIds,
  thisWeek,
}: {
  people: { id: string; display_name: string }[];
  weeks: string[];
  cells: LoadCell[];
  details: LoadDetail[];
  cyanDotIds: string[];
  orangeDotIds: string[];
  thisWeek: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1100,
  );
  const [tip, setTip] = useState<{
    kind: "cell" | "cyan" | "orange";
    person?: string;
    week?: string;
    top: number;
    left: number;
    place: "left" | "right";
  } | null>(null);
  const [tipNudge, setTipNudge] = useState({ x: 0, y: 0 });
  const tipBoxRef = useRef<HTMLDivElement>(null);
  const map = useMemo(() => {
    const result = new Map<string, number>();
    for (const cell of cells) {
      result.set(`${cell.person_id}|${cell.week_start}`, cell.load_count);
    }
    return result;
  }, [cells]);
  const cyanSet = useMemo(() => new Set(cyanDotIds), [cyanDotIds]);
  const orangeSet = useMemo(() => new Set(orangeDotIds), [orangeDotIds]);

  const visibleWeeks = compact ? sliceWeeks(weeks, thisWeek, COMPACT_WEEKS) : weeks;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = (width: number) => setCompact(width < 1100);
    apply(el.clientWidth);
    const ro = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  function hrefWith(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const q = params.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  const step = compact ? COMPACT_WEEKS : 8;
  const prevHref = hrefWith((params) => {
    params.set("start", toISODate(addWeeks(new Date(`${weeks[0]}T00:00:00Z`), -step)));
  });
  const nextHref = hrefWith((params) => {
    params.set("start", toISODate(addWeeks(new Date(`${weeks[0]}T00:00:00Z`), step)));
  });

  const tipDetails = tip?.kind === "cell"
    ? details.filter((d) => d.person_id === tip.person && d.week_start === tip.week)
    : [];
  const grouped = useMemo(() => {
    const byWork = new Map<
      string,
      { key: string; workstream: string; tasks: string[]; client: string; project: string }
    >();
    for (const detail of tipDetails) {
      const project = detail.project_name || detail.project_code;
      const key = `${detail.workstream_name}|${detail.client_name}|${project}`;
      const existing = byWork.get(key);
      if (!existing) {
        byWork.set(key, {
          key,
          workstream: detail.workstream_name,
          tasks: detail.task_name ? [detail.task_name] : [],
          client: detail.client_name,
          project,
        });
      } else if (detail.task_name && !existing.tasks.includes(detail.task_name)) {
        existing.tasks.push(detail.task_name);
      }
    }
    return [...byWork.values()].map((item) => ({
      ...item,
      tasks: item.tasks.sort((a, b) => a.localeCompare(b, "es")),
    }));
  }, [tipDetails]);

  function positionTip(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const gap = 8;
    const place: "left" | "right" = window.innerWidth - r.right > 280 ? "right" : "left";
    return {
      top: r.top + r.height / 2,
      left: place === "right" ? r.right + gap : r.left - gap,
      place,
    };
  }

  useLayoutEffect(() => {
    const el = tipBoxRef.current;
    if (!el) return;
    const margin = 8;
    const rect = el.getBoundingClientRect();
    let x = 0;
    let y = 0;
    if (rect.bottom > window.innerHeight - margin) {
      y -= rect.bottom - (window.innerHeight - margin);
    }
    if (rect.top + y < margin) {
      y += margin - (rect.top + y);
    }
    if (rect.right > window.innerWidth - margin) {
      x -= rect.right - (window.innerWidth - margin);
    }
    if (rect.left + x < margin) {
      x += margin - (rect.left + x);
    }
    if (x !== 0 || y !== 0) setTipNudge({ x, y });
  }, [tip]);

  function showCellTip(person: string, week: string, el: HTMLElement) {
    setTipNudge({ x: 0, y: 0 });
    setTip({ kind: "cell", person, week, ...positionTip(el) });
  }

  function showDotTip(kind: "cyan" | "orange", el: HTMLElement) {
    setTipNudge({ x: 0, y: 0 });
    setTip({ kind, ...positionTip(el) });
  }

  return (
    <div ref={rootRef} className="w-full">
      <table className={`w-full border-collapse text-sm ${compact ? "" : "min-w-max"}`}>
        <thead>
          <tr>
            <th className="sticky left-0 top-16 z-50 border-b border-line bg-white px-3 py-2.5 text-left font-medium text-muted shadow-[1px_0_0_0_var(--line)]">
              Persona
            </th>
            <th className="sticky top-16 z-40 w-8 border-b border-line bg-white p-0">
              <span className="invisible">
                <AngleIcon direction="left" />
              </span>
              <Link
                href={prevHref}
                scroll={false}
                onClick={rememberScroll}
                className="absolute inset-0 flex items-center justify-center text-navy hover:text-cyan"
                aria-label="Semanas anteriores"
              >
                <AngleIcon direction="left" />
              </Link>
            </th>
            {visibleWeeks.map((week) => {
              const current = week === thisWeek;
              const month = isCurrentMonth(week);
              return (
                <th
                  key={week}
                  className={`sticky top-16 z-40 min-w-16 border-b border-line px-1 py-2.5 font-medium ${
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
              <Link
                href={nextHref}
                scroll={false}
                onClick={rememberScroll}
                className="absolute inset-0 flex items-center justify-center text-navy hover:text-cyan"
                aria-label="Semanas siguientes"
              >
                <AngleIcon direction="right" />
              </Link>
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} className="border-t border-line">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 text-base font-medium text-ink shadow-[1px_0_0_0_var(--line)]">
                <span className="inline-flex items-center gap-2">
                  {person.display_name}
                  {orangeSet.has(person.id) ? (
                    <span
                      onMouseEnter={(e) => showDotTip("orange", e.currentTarget)}
                      onMouseLeave={() => setTip(null)}
                      className="inline-block h-2 w-2 rounded-full bg-orange"
                      aria-label="Sin tareas esta semana ni la que viene"
                    />
                  ) : cyanSet.has(person.id) ? (
                    <span
                      onMouseEnter={(e) => showDotTip("cyan", e.currentTarget)}
                      onMouseLeave={() => setTip(null)}
                      className="inline-block h-2 w-2 rounded-full bg-cyan"
                      aria-label="La semana que viene queda en 0"
                    />
                  ) : null}
                </span>
              </td>
              <td />
              {visibleWeeks.map((week) => {
                const count = map.get(`${person.id}|${week}`) ?? 0;
                const current = week === thisWeek;
                return (
                  <td
                    key={week}
                    className={`px-0.5 py-0.5 text-center ${current ? "bg-cyan/5" : ""}`}
                  >
                    <button
                      type="button"
                      onMouseEnter={(e) => showCellTip(person.id, week, e.currentTarget)}
                      onMouseLeave={() => setTip(null)}
                      className="h-9 w-full rounded-md text-base font-bold"
                      style={cellStyle(count)}
                    >
                      {count || ""}
                    </button>
                  </td>
                );
              })}
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      {tip ? (
        <div
          ref={tipBoxRef}
          className="pointer-events-none fixed z-[110] max-w-sm rounded-2xl border border-line bg-white px-3 py-2 text-sm"
          style={{
            top: tip.top,
            left: tip.left,
            transform:
              tip.place === "right"
                ? `translate(${tipNudge.x}px, calc(-50% + ${tipNudge.y}px))`
                : `translate(calc(-100% + ${tipNudge.x}px), calc(-50% + ${tipNudge.y}px))`,
          }}
        >
          {tip.kind === "cyan" ? (
            <p className="font-medium text-ink">La semana que viene queda en 0</p>
          ) : tip.kind === "orange" ? (
            <p className="font-medium text-ink">Esta semana y la que viene quedan en 0</p>
          ) : grouped.length === 0 ? (
            <p className="text-muted">No tiene tareas cargadas esta semana.</p>
          ) : (
            <ul className="space-y-2 text-ink">
              {grouped.map((item) => (
                <li key={item.key}>
                  <div className="font-medium">{item.tasks.join(", ") || item.workstream}</div>
                  {item.tasks.length ? <div>{item.workstream}</div> : null}
                  <div className="break-words text-muted">
                    {[item.client, item.project].filter(Boolean).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
