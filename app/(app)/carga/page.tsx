import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addWeeks, mondayOf, toISODate, weekRange } from "@/lib/dates";
import { LoadHeatmap } from "@/components/LoadHeatmap";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function CargaPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; role?: string }>;
}) {
  await requireSession();
  const { start, role } = await searchParams;
  const startMonday = start ?? toISODate(addWeeks(mondayOf(new Date()), -2));
  const weeks = weekRange(startMonday, 12);
  const thisWeek = toISODate(mondayOf(new Date()));
  const nextWeek = toISODate(addWeeks(mondayOf(new Date()), 1));
  const prev = toISODate(addWeeks(new Date(`${startMonday}T00:00:00Z`), -8));
  const next = toISODate(addWeeks(new Date(`${startMonday}T00:00:00Z`), 8));
  const roleQuery = role ? `&role=${role}` : "";

  const supabase = await createClient();
  const [{ data: people }, { data: cells }, { data: details }, { data: roles }] = await Promise.all([
    supabase
      .from("people")
      .select("id, display_name, person_roles(role_id)")
      .is("deleted_at", null)
      .eq("hidden", false)
      .order("display_name"),
    supabase.from("person_week_load").select("person_id, week_start, load_count").in("week_start", weeks),
    supabase
      .from("person_week_load_detail")
      .select("person_id, week_start, project_code, workstream_name, task_name, role_name")
      .in("week_start", weeks),
    supabase.from("roles").select("id, name").is("deleted_at", null).order("name"),
  ]);

  const filtered = (people ?? []).filter((p) => {
    if (!role) return true;
    return (p.person_roles ?? []).some((pr) => pr.role_id === role);
  });

  const thisWeekLoad = new Set(
    (cells ?? []).filter((c) => c.week_start === thisWeek && c.load_count > 0).map((c) => c.person_id),
  );
  const nextWeekLoad = new Set(
    (cells ?? []).filter((c) => c.week_start === nextWeek && c.load_count > 0).map((c) => c.person_id),
  );
  const zeroNextWeekIds = filtered
    .filter((p) => thisWeekLoad.has(p.id) && !nextWeekLoad.has(p.id))
    .map((p) => p.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workload"
        description="Número de workstreams activos por persona y semana. PM y Supervisión cuentan si hay cualquier tarea."
      />
      <FilterChips
        items={[
          { href: `/carga?start=${startMonday}`, label: "Todos", active: !role },
          ...(roles ?? []).map((r) => ({
            href: `/carga?start=${startMonday}&role=${r.id}`,
            label: r.name,
            active: role === r.id,
          })),
        ]}
      />
      <LoadHeatmap
        people={filtered}
        weeks={weeks}
        cells={cells ?? []}
        details={details ?? []}
        zeroNextWeekIds={zeroNextWeekIds}
        thisWeek={thisWeek}
        prevHref={`/carga?start=${prev}${roleQuery}`}
        nextHref={`/carga?start=${next}${roleQuery}`}
      />
    </div>
  );
}
