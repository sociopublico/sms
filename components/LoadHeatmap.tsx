"use client";

import { useMemo, useState } from "react";
import { formatWeekLabel } from "@/lib/dates";

export type LoadCell = { person_id: string; week_start: string; load_count: number };
export type LoadDetail = {
  person_id: string;
  week_start: string;
  project_code: string;
  workstream_name: string;
  task_name: string;
  role_name: string;
};

export function LoadHeatmap({
  people,
  weeks,
  cells,
  details,
  zeroAlerts,
}: {
  people: { id: string; display_name: string }[];
  weeks: string[];
  cells: LoadCell[];
  details: LoadDetail[];
  zeroAlerts: string[];
}) {
  const [open, setOpen] = useState<{ person: string; week: string } | null>(null);
  const map = useMemo(() => {
    const result = new Map<string, number>();
    for (const cell of cells) {
      result.set(`${cell.person_id}|${cell.week_start}`, cell.load_count);
    }
    return result;
  }, [cells]);

  const openDetails = open
    ? details.filter((d) => d.person_id === open.person && d.week_start === open.week)
    : [];
  const openPerson = people.find((p) => p.id === open?.person);

  return (
    <div className="space-y-4">
      {zeroAlerts.length > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          La semana que viene quedan en 0 (puede ser timeline desactualizado):{" "}
          {zeroAlerts.join(", ")}
        </div>
      ) : null}
      <div className="overflow-auto rounded border border-stone-200 bg-white">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-stone-50">
              <th className="sticky left-0 z-10 bg-stone-50 px-3 py-2 text-left">Persona</th>
              {weeks.map((week) => (
                <th key={week} className="min-w-16 px-1 py-2 font-normal text-stone-500">
                  {formatWeekLabel(week)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="border-t border-stone-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium">{person.display_name}</td>
                {weeks.map((week) => {
                  const count = map.get(`${person.id}|${week}`) ?? 0;
                  const intensity = Math.min(count / 8, 1);
                  const bg = count === 0 ? "transparent" : `rgba(28, 25, 23, ${0.08 + intensity * 0.45})`;
                  const color = intensity > 0.5 ? "#fff" : undefined;
                  return (
                    <td key={week} className="px-0.5 py-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => setOpen({ person: person.id, week })}
                        className="h-8 w-full rounded"
                        style={{ background: bg, color }}
                      >
                        {count || ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <aside className="rounded border border-stone-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-medium">
                {openPerson?.display_name} · semana {formatWeekLabel(open.week)}
              </h2>
              <p className="text-sm text-stone-500">
                {openDetails.length === 0
                  ? "Nada cuenta esta semana."
                  : `${new Set(openDetails.map((d) => d.workstream_name)).size} workstreams`}
              </p>
            </div>
            <button type="button" className="text-sm underline" onClick={() => setOpen(null)}>
              Cerrar
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {openDetails.map((d, i) => (
              <li key={`${d.workstream_name}-${d.task_name}-${d.role_name}-${i}`}>
                <span className="font-medium">{d.project_code}</span>
                <span className="text-stone-500"> · {d.workstream_name}</span>
                <div className="text-stone-500">
                  {d.task_name} ({d.role_name})
                </div>
              </li>
            ))}
          </ul>
        </aside>
      ) : (
        <p className="text-sm text-stone-500">Clic en una celda para ver qué proyectos se cuentan.</p>
      )}
    </div>
  );
}
