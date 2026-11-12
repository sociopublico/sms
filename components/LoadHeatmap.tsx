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
  project_id: string;
  project_code: string;
  client_name: string;
  workstream_id: string;
  workstream_name: string;
  task_name: string;
  role_name: string;
  always_on_duty: boolean;
};

type TipEntry = {
  key: string;
  client_name: string;
  project_id: string;
  project_code: string;
  workstream_id: string;
  workstream_name: string;
  typeLabel: string;
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

function buildTipEntries(rows: LoadDetail[]): TipEntry[] {
  const byWs = new Map<string, LoadDetail[]>();
  for (const row of rows) {
    const key = `${row.workstream_id}|${row.role_name}`;
    const list = byWs.get(key);
    if (list) list.push(row);
    else byWs.set(key, [row]);
  }
  return [...byWs.values()].map((group) => {
    const first = group[0];
    const typeLabel = first.always_on_duty
      ? first.role_name
      : [...new Set(group.map((g) => g.task_name))].join(", ");
    return {
      key: `${first.workstream_id}|${first.role_name}`,
      client_name: first.client_name || "—",
      project_id: first.project_id,
      project_code: first.project_code,
      workstream_id: first.workstream_id,
      workstream_name: first.workstream_name,
      typeLabel,
    };
  });
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
    vPlace: "center" | "above" | "below";
  } | null>(null);
  const tipHideTimer = useRef<number | null>(null);

  function clearTipHide() {
    if (tipHideTimer.current) {
      window.clearTimeout(tipHideTimer.current);
      tipHideTimer.current = null;
    }
  }

  function scheduleTipHide() {
    clearTipHide();
    tipHideTimer.current = window.setTimeout(() => setTip(null), 180);
  }
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

  const tipEntries = useMemo(() => {
    if (tip?.kind !== "cell" || !tip.person || !tip.week) return [];
    return buildTipEntries(
      details.filter((d) => d.person_id === tip.person && d.week_start === tip.week),
    );
  }, [details, tip]);

  function positionTip(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const gap = 8;
    const place: "left" | "right" = window.innerWidth - r.right > 240 ? "right" : "left";
    const tipH = 200;
    const midY = r.top + r.height / 2;
    let vPlace: "center" | "above" | "below" = "center";
    let top = midY;
    if (midY + tipH / 2 > window.innerHeight - 8) {
      vPlace = "above";
      top = r.top - gap;
    } else if (midY - tipH / 2 < 8) {
      vPlace = "below";
      top = r.bottom + gap;
    }
    return {
      top,
      left: place === "right" ? r.right + gap : r.left - gap,
      place,
      vPlace,
    };
  }

  function showCellTip(person: string, week: string, el: HTMLElement) {
    clearTipHide();
    setTip({ kind: "cell", person, week, ...positionTip(el) });
  }

  function showDotTip(kind: "cyan" | "orange", el: HTMLElement) {
    clearTipHide();
    setTip({ kind, ...positionTip(el) });
  }

  useEffect(
    () => () => {
      clearTipHide();
    },
    [],
  );

  return (
    <div ref={rootRef} className="w-full">
      <div className="-mx-1 overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${compact ? "" : "min-w-max"}`}>
        <thead>
          <tr>
            <th className="sticky left-0 top-16 z-50 border-b border-line bg-paper px-3 py-2.5 text-left font-medium text-muted shadow-[1px_0_0_0_var(--line)]">
              Persona
            </th>
            <th className="sticky top-16 z-40 w-8 border-b border-line bg-paper p-0">
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
                    current ? "bg-[#d9eef6] text-cyan" : month ? "bg-canvas text-ink" : "bg-paper text-muted"
                  }`}
                >
                  {formatWeekLabel(week)}
                  {current ? <div className="text-xs font-normal">hoy</div> : null}
                </th>
              );
            })}
            <th className="sticky top-16 z-40 w-8 border-b border-line bg-paper p-0">
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
              <td className="sticky left-0 z-10 bg-paper px-3 py-2 text-base font-medium text-ink shadow-[1px_0_0_0_var(--line)]">
                <span className="inline-flex items-center gap-2">
                  {person.display_name}
                  {orangeSet.has(person.id) ? (
                    <span
                      role="img"
                      onMouseEnter={(e) => showDotTip("orange", e.currentTarget)}
                      onMouseLeave={scheduleTipHide}
                      className="inline-block h-2 w-2 rounded-full bg-orange"
                      aria-label="Sin tareas esta semana ni la que viene"
                    />
                  ) : cyanSet.has(person.id) ? (
                    <span
                      role="img"
                      onMouseEnter={(e) => showDotTip("cyan", e.currentTarget)}
                      onMouseLeave={scheduleTipHide}
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
                      aria-label={`${person.display_name}, semana ${week}: ${count} ${count === 1 ? "tarea" : "tareas"}`}
                      onMouseEnter={(e) => showCellTip(person.id, week, e.currentTarget)}
                      onMouseLeave={scheduleTipHide}
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
      </div>

      {tip ? (
        <div
          className={`fixed z-[110] max-w-sm rounded-2xl border border-line bg-paper px-3 py-2 text-sm ${
            tip.kind === "cell" && tipEntries.length ? "pointer-events-auto" : "pointer-events-none"
          }`}
          style={{
            top: tip.top,
            left: tip.left,
            transform: [
              tip.place === "right" ? "translateX(0)" : "translateX(-100%)",
              tip.vPlace === "center" ? "translateY(-50%)" : tip.vPlace === "above" ? "translateY(-100%)" : "translateY(0)",
            ].join(" "),
          }}
          onMouseEnter={clearTipHide}
          onMouseLeave={scheduleTipHide}
        >
          {tip.kind === "cyan" ? (
            <p className="font-medium text-ink">La semana que viene queda en 0</p>
          ) : tip.kind === "orange" ? (
            <p className="font-medium text-ink">Esta semana y la que viene quedan en 0</p>
          ) : tipEntries.length === 0 ? (
            <p className="text-muted">No tiene tareas cargadas esta semana.</p>
          ) : (
            <ul className="space-y-3 text-ink">
              {tipEntries.map((entry) => (
                <li key={entry.key} className="space-y-0.5">
                  <div className="font-medium text-navy">{entry.client_name}</div>
                  <div>
                    <Link href={`/proyectos/${entry.project_id}`} className="text-cyan hover:underline">
                      {entry.project_code}
                    </Link>
                  </div>
                  <div>
                    <Link href={`/workstreams/${entry.workstream_id}`} className="hover:text-cyan hover:underline">
                      {entry.workstream_name}
                    </Link>
                  </div>
                  <div className="text-muted">{entry.typeLabel}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
