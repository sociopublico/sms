"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWeekLabel, isCurrentMonth } from "@/lib/dates";

export type LoadCell = { person_id: string; week_start: string; load_count: number };
export type LoadDetail = {
  person_id: string;
  week_start: string;
  project_code: string;
  workstream_name: string;
  task_name: string;
  role_name: string;
};

const LEGEND = [0, 2, 4, 6, 8];

function cellStyle(count: number) {
  if (count === 0) return { background: "transparent", color: undefined as string | undefined };
  const intensity = Math.min(count / 8, 1);
  return {
    background: `rgba(64, 153, 247, ${0.12 + intensity * 0.78})`,
    color: intensity > 0.45 ? "#fff" : "#16222F",
  };
}

export function LoadHeatmap({
  people,
  weeks,
  cells,
  details,
  zeroNextWeekIds,
  thisWeek,
  prevHref,
  nextHref,
}: {
  people: { id: string; display_name: string }[];
  weeks: string[];
  cells: LoadCell[];
  details: LoadDetail[];
  zeroNextWeekIds: string[];
  thisWeek: string;
  prevHref: string;
  nextHref: string;
}) {
  const [tip, setTip] = useState<{
    kind: "cell" | "zero";
    person?: string;
    week?: string;
    top: number;
    left: number;
    place: "left" | "right";
  } | null>(null);
  const map = useMemo(() => {
    const result = new Map<string, number>();
    for (const cell of cells) {
      result.set(`${cell.person_id}|${cell.week_start}`, cell.load_count);
    }
    return result;
  }, [cells]);
  const zeroSet = useMemo(() => new Set(zeroNextWeekIds), [zeroNextWeekIds]);

  const tipDetails = tip?.kind === "cell"
    ? details.filter((d) => d.person_id === tip.person && d.week_start === tip.week)
    : [];
  const grouped = useMemo(() => {
    const names = new Set<string>();
    for (const d of tipDetails) names.add(d.workstream_name);
    return [...names];
  }, [tipDetails]);

  function positionTip(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const gap = 8;
    const place: "left" | "right" = window.innerWidth - r.right > 240 ? "right" : "left";
    return {
      top: r.top + r.height / 2,
      left: place === "right" ? r.right + gap : r.left - gap,
      place,
    };
  }

  function showCellTip(person: string, week: string, el: HTMLElement) {
    setTip({ kind: "cell", person, week, ...positionTip(el) });
  }

  function showZeroTip(el: HTMLElement) {
    setTip({ kind: "zero", ...positionTip(el) });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>Workstreams por semana</span>
        <div className="flex items-center gap-1">
          {LEGEND.map((n) => (
            <span
              key={n}
              className="inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-sm font-medium"
              style={cellStyle(n)}
            >
              {n}
            </span>
          ))}
        </div>
      </div>

      <div className="w-full">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-16 z-50 border-b border-line bg-white px-3 py-2.5 text-left font-medium text-muted shadow-[1px_0_0_0_var(--line)]">
                Persona
              </th>
              <th className="sticky top-16 z-40 w-8 border-b border-line bg-white px-0">
                <Link href={prevHref} className="flex h-full items-center justify-center text-navy hover:text-cyan" aria-label="Semanas anteriores">
                  ‹
                </Link>
              </th>
              {weeks.map((week) => {
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
              <th className="sticky top-16 z-40 w-8 border-b border-line bg-white px-0">
                <Link href={nextHref} className="flex h-full items-center justify-center text-navy hover:text-cyan" aria-label="Semanas siguientes">
                  ›
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
                    {zeroSet.has(person.id) ? (
                      <span
                        onMouseEnter={(e) => showZeroTip(e.currentTarget)}
                        onMouseLeave={() => setTip(null)}
                        className="inline-block h-2 w-2 rounded-full bg-cyan"
                      />
                    ) : null}
                  </span>
                </td>
                <td className="bg-paper" />
                {weeks.map((week) => {
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
                        className="h-9 w-full rounded-md text-sm"
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
          className="pointer-events-none fixed z-[110] max-w-xs rounded-2xl border border-line bg-white px-3 py-2 text-sm"
          style={{
            top: tip.top,
            left: tip.left,
            transform: tip.place === "right" ? "translateY(-50%)" : "translate(-100%, -50%)",
          }}
        >
          {tip.kind === "zero" ? (
            <p className="font-medium text-ink">La semana que viene queda en 0</p>
          ) : grouped.length === 0 ? (
            <p className="text-muted">No tiene tareas cargadas esta semana.</p>
          ) : (
            <ul className="space-y-1 text-ink ">
              {grouped.map((name) => (
                <li className="ml-3 -pl-4 list-disc" key={name}>{name}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
