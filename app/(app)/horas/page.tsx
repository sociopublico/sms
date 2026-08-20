import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HoursMatrixEditor } from "@/components/HoursMatrixEditor";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageHeader } from "@/components/ui/PageHeader";
import { monthLabelEs } from "@/lib/toggl-import";

export default async function HorasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; year?: string }>;
}) {
  const session = await requireWriter();
  const { q, year } = await searchParams;
  const supabase = await createClient();

  const [{ data: entries }, { data: budgets }, { data: people }] = await Promise.all([
    supabase
      .from("time_entries")
      .select(
        "person_id, raw_client_label, raw_project_label, project_id, month_start, hours, people(display_name)",
      ),
    supabase
      .from("person_project_budgets")
      .select(
        "person_id, raw_client_label, raw_project_label, project_id, estimated_hours, people(display_name)",
      ),
    supabase.from("people").select("id, display_name").eq("hidden", false).order("display_name"),
  ]);

  const months = new Set<string>();
  for (const entry of entries ?? []) months.add(entry.month_start);
  const allMonths = [...months].sort();
  const years = [...new Set(allMonths.map((m) => m.slice(0, 4)))].sort();
  const activeYear = year && years.includes(year) ? year : years[years.length - 1] ?? null;
  const visibleMonths = activeYear
    ? allMonths.filter((m) => m.startsWith(activeYear))
    : allMonths;

  type PersonCell = {
    personId: string;
    personName: string;
    estimatedHours: number;
    byMonth: Record<string, number>;
  };

  type ProjectGroup = {
    key: string;
    client: string;
    project: string;
    projectId: string | null;
    people: Map<string, PersonCell>;
  };

  const groups = new Map<string, ProjectGroup>();

  function ensureGroup(client: string, project: string, projectId: string | null) {
    const key = `${client}\0${project}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, client, project, projectId, people: new Map() };
      groups.set(key, group);
    } else if (!group.projectId && projectId) {
      group.projectId = projectId;
    }
    return group;
  }

  function ensurePerson(group: ProjectGroup, personId: string, personName: string) {
    let cell = group.people.get(personId);
    if (!cell) {
      cell = { personId, personName, estimatedHours: 0, byMonth: {} };
      group.people.set(personId, cell);
    }
    return cell;
  }

  function personNameFrom(
    join: { display_name: string } | { display_name: string }[] | null,
    fallbackId: string,
  ) {
    if (Array.isArray(join)) return join[0]?.display_name ?? fallbackId;
    return join?.display_name ?? fallbackId;
  }

  for (const budget of budgets ?? []) {
    const group = ensureGroup(
      budget.raw_client_label,
      budget.raw_project_label,
      budget.project_id,
    );
    const name = personNameFrom(
      budget.people as { display_name: string } | { display_name: string }[] | null,
      budget.person_id,
    );
    const cell = ensurePerson(group, budget.person_id, name);
    cell.estimatedHours = Number(budget.estimated_hours) || 0;
  }

  for (const entry of entries ?? []) {
    if (activeYear && !entry.month_start.startsWith(activeYear)) continue;
    const group = ensureGroup(entry.raw_client_label, entry.raw_project_label, entry.project_id);
    const name = personNameFrom(
      entry.people as { display_name: string } | { display_name: string }[] | null,
      entry.person_id,
    );
    const cell = ensurePerson(group, entry.person_id, name);
    cell.byMonth[entry.month_start] =
      (cell.byMonth[entry.month_start] ?? 0) + (Number(entry.hours) || 0);
  }

  const query = (q ?? "").trim().toLowerCase();
  const projectRows = [...groups.values()]
    .map((group) => {
      const peopleRows = [...group.people.values()]
        .map((person) => {
          const real = Object.values(person.byMonth).reduce((a, b) => a + b, 0);
          return {
            ...person,
            realHours: real,
            diffHours: person.estimatedHours - real,
            monthHours: visibleMonths.map((month) => person.byMonth[month] ?? 0),
          };
        })
        .filter((person) => person.estimatedHours > 0 || person.realHours > 0)
        .sort((a, b) => a.personName.localeCompare(b.personName, "es"));
      return {
        key: group.key,
        client: group.client,
        project: group.project,
        projectId: group.projectId,
        linked: Boolean(group.projectId),
        people: peopleRows,
        estimatedTotal: peopleRows.reduce((a, p) => a + p.estimatedHours, 0),
        realTotal: peopleRows.reduce((a, p) => a + p.realHours, 0),
      };
    })
    .filter((group) => {
      if (!group.people.length) return false;
      if (!query) return true;
      return (
        group.client.toLowerCase().includes(query) ||
        group.project.toLowerCase().includes(query) ||
        group.people.some((p) => p.personName.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      const c = a.client.localeCompare(b.client, "es");
      return c !== 0 ? c : a.project.localeCompare(b.project, "es");
    });

  const yearChips = [
    ...years.map((y) => ({
      href: `/horas?year=${y}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      label: y,
      active: activeYear === y,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horas"
        description="Proyectadas (PROY) vs reales por persona y mes. Los labels del sheet todavía pueden no estar vinculados a un proyecto SMS."
        actions={
          session.isAdmin || session.canWrite ? (
            <a href="/horas/sync" className="text-sm font-medium text-cyan hover:text-cyan">
              Sync CSV →
            </a>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips items={yearChips} />
        <form className="ml-auto">
          {activeYear ? <input type="hidden" name="year" value={activeYear} /> : null}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar cliente, proyecto o persona…"
            className="w-64 rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink outline-none focus:border-cyan"
          />
        </form>
      </div>
      <HoursMatrixEditor
        canEdit={session.canWrite}
        months={visibleMonths.map((m) => ({ key: m, label: monthLabelEs(m) }))}
        projects={projectRows.map((project) => ({
          key: project.key,
          client: project.client,
          project: project.project,
          projectId: project.projectId,
          linked: project.linked,
          people: project.people.map((person) => ({
            id: person.personId,
            name: person.personName,
            estimatedHours: person.estimatedHours,
            monthHours: person.monthHours,
          })),
        }))}
      />
      <p className="text-sm text-muted">
        {(people ?? []).length} personas en catálogo · {projectRows.length} proyectos en la vista
        {activeYear ? ` · ${activeYear}` : ""}
      </p>
    </div>
  );
}
