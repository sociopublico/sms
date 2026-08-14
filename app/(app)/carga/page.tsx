import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addWeeks, mondayOf, toISODate, weekRange } from "@/lib/dates";
import { LoadHeatmap } from "@/components/LoadHeatmap";

export default async function CargaPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  await requireSession();
  const { start } = await searchParams;
  const startMonday = start ?? toISODate(addWeeks(mondayOf(new Date()), -2));
  const weeks = weekRange(startMonday, 12);
  const thisWeek = toISODate(mondayOf(new Date()));
  const nextWeek = toISODate(addWeeks(mondayOf(new Date()), 1));

  const supabase = await createClient();
  const [{ data: people }, { data: cells }, { data: details }] = await Promise.all([
    supabase.from("people").select("id, display_name").is("deleted_at", null).order("display_name"),
    supabase.from("person_week_load").select("person_id, week_start, load_count").in("week_start", weeks),
    supabase
      .from("person_week_load_detail")
      .select("person_id, week_start, project_code, workstream_name, task_name, role_name")
      .in("week_start", weeks),
  ]);

  const thisWeekLoad = new Set(
    (cells ?? []).filter((c) => c.week_start === thisWeek && c.load_count > 0).map((c) => c.person_id),
  );
  const nextWeekLoad = new Set(
    (cells ?? []).filter((c) => c.week_start === nextWeek && c.load_count > 0).map((c) => c.person_id),
  );
  const zeroAlerts = (people ?? [])
    .filter((p) => thisWeekLoad.has(p.id) && !nextWeekLoad.has(p.id))
    .map((p) => p.display_name);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Carga del equipo</h1>
        <p className="text-sm text-stone-600">
          Número de workstreams activos por persona y semana. PM y Supervisión cuentan si hay cualquier
          tarea.
        </p>
      </div>
      <LoadHeatmap
        people={people ?? []}
        weeks={weeks}
        cells={cells ?? []}
        details={details ?? []}
        zeroAlerts={zeroAlerts}
      />
    </div>
  );
}
