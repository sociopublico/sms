import { createClient } from "@/lib/supabase/client";

export type WeekTask = { id: string; name: string; color: string };

type TaskRel = WeekTask | WeekTask[] | null;

export async function fetchTasksByWeek(weeks: string[]) {
  const map: Record<string, Record<string, WeekTask[]>> = {};
  if (!weeks.length) return map;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("timeline_weeks")
    .select("workstream_id, week_start, timeline_week_tasks(tasks(id, name, color))")
    .in("week_start", weeks);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const tasks = ((row.timeline_week_tasks ?? []) as { tasks: TaskRel }[])
      .map((item) => {
        const task = item.tasks;
        return Array.isArray(task) ? task[0] : task;
      })
      .filter((task): task is WeekTask => Boolean(task?.id));
    const workstreamId = String(row.workstream_id);
    const week = String(row.week_start).slice(0, 10);
    map[workstreamId] ??= {};
    map[workstreamId][week] = tasks;
  }
  return map;
}

export function mergeWeekMaps(
  base: Record<string, Record<string, WeekTask[]>>,
  extra: Record<string, Record<string, WeekTask[]>>,
) {
  const next: Record<string, Record<string, WeekTask[]>> = { ...base };
  for (const [workstreamId, byWeek] of Object.entries(extra)) {
    next[workstreamId] = { ...next[workstreamId], ...byWeek };
  }
  return next;
}
