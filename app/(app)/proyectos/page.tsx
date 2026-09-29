import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { ProjectExtraFilters } from "@/components/ProjectExtraFilters";
import { ProjectList } from "@/components/ProjectList";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { missingFicha } from "@/components/ui/FichaMissing";
import { PageHeader } from "@/components/ui/PageHeader";

type ProjectFilters = {
  status?: string;
  client?: string;
  ficha?: string;
  horas?: string;
};

function proyectosHref(params: ProjectFilters) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.client) search.set("client", params.client);
  if (params.ficha === "con" || params.ficha === "sin") search.set("ficha", params.ficha);
  if (params.horas === "con" || params.horas === "sin") search.set("horas", params.horas);
  const query = search.toString();
  return query ? `/proyectos?${query}` : "/proyectos";
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<ProjectFilters>;
}) {
  const session = await requireSession();
  const { status, client, ficha, horas } = await searchParams;
  const fichaFilter = ficha === "con" || ficha === "sin" ? ficha : undefined;
  const horasFilter = horas === "con" || horas === "sin" ? horas : undefined;
  const filters: ProjectFilters = {
    status: status || undefined,
    client: client || undefined,
    ficha: fichaFilter,
    horas: horasFilter,
  };

  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, code, name, ficha_url, kind, status, client_id, clients(name), workstreams(id, name, status)")
    .order("code");
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.client) query = query.eq("client_id", filters.client);

  const [{ data: projects }, { data: aliasRows }, { data: clients }] = await Promise.all([
    query,
    supabase.from("project_aliases").select("project_id").not("project_id", "is", null),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const projectsWithAlias = new Set(
    (aliasRows ?? []).map((row) => row.project_id).filter((id): id is string => Boolean(id)),
  );

  const mapped = (projects ?? []).map((project) => {
    const clientRow = project.clients as { name: string } | { name: string }[] | null;
    const clientName = Array.isArray(clientRow) ? clientRow[0]?.name : clientRow?.name;
    return {
      id: project.id,
      code: project.code,
      name: project.name?.trim() || "",
      ficha_url: project.ficha_url,
      status: project.status,
      clientName: clientName ?? "",
      hasHoursAlias: projectsWithAlias.has(project.id),
      workstreams: project.workstreams ?? [],
    };
  });

  const filtered = mapped.filter((project) => {
    if (filters.ficha === "con" && missingFicha(project.ficha_url)) return false;
    if (filters.ficha === "sin" && !missingFicha(project.ficha_url)) return false;
    if (filters.horas === "con" && !project.hasHoursAlias) return false;
    if (filters.horas === "sin" && project.hasHoursAlias) return false;
    return true;
  });

  const statusChips = [
    { href: proyectosHref({ ...filters, status: undefined }), label: "Todos", active: !filters.status },
    {
      href: proyectosHref({ ...filters, status: "en_curso" }),
      label: "En curso",
      active: filters.status === "en_curso",
    },
    {
      href: proyectosHref({ ...filters, status: "pausado" }),
      label: "Pausado",
      active: filters.status === "pausado",
    },
    {
      href: proyectosHref({ ...filters, status: "mantenimiento" }),
      label: "Mantenimiento",
      active: filters.status === "mantenimiento",
    },
    {
      href: proyectosHref({ ...filters, status: "finalizado" }),
      label: "Finalizado",
      active: filters.status === "finalizado",
    },
  ];

  const fichaChips = [
    { href: proyectosHref({ ...filters, ficha: undefined }), label: "Todas", active: !filters.ficha },
    {
      href: proyectosHref({ ...filters, ficha: "con" }),
      label: "Con ficha",
      active: filters.ficha === "con",
    },
    {
      href: proyectosHref({ ...filters, ficha: "sin" }),
      label: "Sin ficha",
      active: filters.ficha === "sin",
    },
  ];

  const horasChips = [
    { href: proyectosHref({ ...filters, horas: undefined }), label: "Todas", active: !filters.horas },
    {
      href: proyectosHref({ ...filters, horas: "con" }),
      label: "Con label horas",
      active: filters.horas === "con",
    },
    {
      href: proyectosHref({ ...filters, horas: "sin" }),
      label: "Sin label horas",
      active: filters.horas === "sin",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyectos"
        description="Contrato (ID) con cero o más workstreams."
        actions={
          session.canWrite ? (
            <Button href="/proyectos/nuevo" variant="primary">
              Nuevo proyecto
            </Button>
          ) : null
        }
      />
      <FilterChips items={statusChips} />
      <ProjectExtraFilters
        clients={clients ?? []}
        filters={filters}
        fichaChips={fichaChips}
        horasChips={horasChips}
      />
      <ProjectList canWrite={session.canWrite} projects={filtered} />
    </div>
  );
}
