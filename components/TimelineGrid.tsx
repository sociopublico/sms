"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatWeekLabel } from "@/lib/dates";
import { setWeekTasks } from "@/app/(app)/project-actions";

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
}: {
  weeks: string[];
  rows: TimelineRow[];
  tasks: TimelineTask[];
  canWrite: boolean;
}) {
  const [open, setOpen] = useState<{ ws: string; week: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const taskMap = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  function toggle(wsId: string, week: string, current: TimelineTask[], taskId: string) {
    const ids = current.map((t) => t.id);
    const next = ids.includes(taskId) ? ids.filter((id) => id !== taskId) : [...ids, taskId];
    startTransition(async () => {
      await setWeekTasks(wsId, week, next);
    });
  }

  return (
    <div className="overflow-auto rounded border border-stone-200 bg-white">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="bg-stone-50">
            <th className="sticky left-0 z-10 min-w-64 bg-stone-50 px-3 py-2 text-left">Workstream</th>
            <th className="min-w-28 px-2 text-left">PM</th>
            {weeks.map((week) => (
              <th key={week} className="min-w-24 px-1 py-2 font-normal text-stone-500">
                {formatWeekLabel(week)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-stone-100">
              <td className="sticky left-0 z-10 bg-white px-3 py-2">
                <Link href={`/workstreams/${row.id}`} className="font-medium hover:underline">
                  {row.name}
                </Link>
                <div className="text-stone-500">
                  {row.clientName} · {row.projectCode}
                </div>
              </td>
              <td className="px-2 text-stone-600">{row.pms.join(", ") || "—"}</td>
              {weeks.map((week) => {
                const cellTasks = row.tasksByWeek[week] ?? [];
                const isOpen = open?.ws === row.id && open.week === week;
                return (
                  <td key={week} className="relative px-1 py-1 align-top">
                    <button
                      type="button"
                      disabled={!canWrite || pending}
                      onClick={() => setOpen(isOpen ? null : { ws: row.id, week })}
                      className="flex min-h-10 w-full flex-col gap-0.5 rounded border border-transparent px-1 py-1 text-left hover:border-stone-300"
                    >
                      {cellTasks.length === 0 ? (
                        <span className="text-stone-300">·</span>
                      ) : (
                        cellTasks.map((task) => (
                          <span
                            key={task.id}
                            className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                            style={{ background: task.color }}
                          >
                            {task.name}
                          </span>
                        ))
                      )}
                    </button>
                    {isOpen ? (
                      <div className="absolute z-20 mt-1 max-h-56 w-48 overflow-auto rounded border border-stone-200 bg-white p-2 shadow-none">
                        {tasks.map((task) => {
                          const checked = cellTasks.some((t) => t.id === task.id);
                          return (
                            <label key={task.id} className="flex items-center gap-2 py-0.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(row.id, week, cellTasks, task.id)}
                              />
                              <span className="h-2 w-2 rounded-sm" style={{ background: task.color }} />
                              {task.name}
                            </label>
                          );
                        })}
                        <div className="pt-1 text-stone-400">
                          {taskMap ? `${cellTasks.length} seleccionadas` : null}
                        </div>
                      </div>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
