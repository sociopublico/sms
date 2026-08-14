import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addWeeks, mondayOf, toISODate, weekRange } from "@/lib/dates";
import { TimelineGrid, type TimelineRow, type TimelineTask } from "@/components/TimelineGrid";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; status?: string }>;
}) {
  const session = await requireSession();
  const { start, status } = await searchParams;
  const startMonday = start ?? toISODate(addWeeks(mondayOf(new Date()), -4));
  const weeks = weekRange(startMonday, 12);
  const supabase = await createClient();

  let wsQuery = supabase
    .from("workstreams")
    .select(
      "id, name, status, start_on, end_on, projects(code, clients(name)), assignments(roles(name), people(display_name))",
    )
    .in("status", status ? [status] : ["en_curso", "pausado", "mantenimiento"])
    .order("name");
  const { data: workstreams } = await wsQuery;

  const { data: tasks } = await supabase.from("tasks").select("id, name, color").order("name");
  const { data: weekRows } = await supabase
    .from("timeline_weeks")
    .select("id, workstream_id, week_start, timeline_week_tasks(task_id, tasks(id, name, color))")
    .in("week_start", weeks);

  const tasksByWs: Record<string, Record<string, TimelineTask[]>> = {};
  for (const row of weekRows ?? []) {
    const list =
      (row.timeline_week_tasks ?? []).map((twt) => {
        const t = twt.tasks as TimelineTask | TimelineTask[] | null;
        return Array.isArray(t) ? t[0] : t;
      }).filter(Boolean) as TimelineTask[];
    tasksByWs[row.workstream_id] ??= {};
    tasksByWs[row.workstream_id][row.week_start] = list;
  }

  const rows: TimelineRow[] = (workstreams ?? []).map((ws) => {
    const project = ws.projects as
      | { code: string; clients: { name: string } | { name: string }[] }
      | { code: string; clients: { name: string } | { name: string }[] }[]
      | null;
    const proj = Array.isArray(project) ? project[0] : project;
    const clientRel = proj?.clients;
    const clientName = Array.isArray(clientRel) ? clientRel[0]?.name : clientRel?.name;
    const pms = (ws.assignments ?? [])
      .filter((a) => {
        const role = a.roles as { name: string } | { name: string }[] | null;
        const name = Array.isArray(role) ? role[0]?.name : role?.name;
        return name === "PM";
      })
      .map((a) => {
        const person = a.people as { display_name: string } | { display_name: string }[] | null;
        return Array.isArray(person) ? person[0]?.display_name : person?.display_name;
      })
      .filter(Boolean) as string[];
    return {
      id: ws.id,
      name: ws.name,
      status: ws.status,
      start_on: ws.start_on,
      end_on: ws.end_on,
      projectCode: proj?.code ?? "",
      clientName: clientName ?? "",
      pms,
      tasksByWeek: tasksByWs[ws.id] ?? {},
    };
  });

  const prev = toISODate(addWeeks(new Date(`${startMonday}T00:00:00Z`), -8));
  const next = toISODate(addWeeks(new Date(`${startMonday}T00:00:00Z`), 8));
  const statusQuery = status ? `&status=${status}` : "";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
          <p className="text-sm text-stone-600">Multiselect de tareas por semana. Las fechas se derivan solas.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/timeline?start=${prev}${statusQuery}`} className="rounded border border-stone-200 bg-white px-3 py-1">
            Semanas anteriores
          </Link>
          <Link href={`/timeline?start=${next}${statusQuery}`} className="rounded border border-stone-200 bg-white px-3 py-1">
            Semanas siguientes
          </Link>
        </div>
      </div>
      <div className="flex gap-2 text-sm">
        {[
          ["", "Activos"],
          ["en_curso", "En curso"],
          ["pausado", "Pausado"],
          ["mantenimiento", "Mantenimiento"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/timeline?start=${startMonday}${value ? `&status=${value}` : ""}`}
            className={`rounded px-3 py-1 ${(!status && !value) || status === value ? "bg-stone-900 text-white" : "border border-stone-200 bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <TimelineGrid
        weeks={weeks}
        rows={rows}
        tasks={(tasks ?? []) as TimelineTask[]}
        canWrite={session.canWrite}
      />
    </div>
  );
}
