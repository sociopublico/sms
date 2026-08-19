import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { ProjectList } from "@/components/ProjectList";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const { status } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, code, ficha_url, kind, status, clients(name), workstreams(id, name, status)")
    .order("code");
  if (status) query = query.eq("status", status);
  const { data: projects } = await query;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyectos"
        description="Contrato (ID) con uno o más workstreams."
        actions={
          <Button href="/proyectos/nuevo" variant="primary">
            Nuevo workstream
          </Button>
        }
      />
      <FilterChips
        items={[
          { href: "/proyectos", label: "Todos", active: !status },
          { href: "/proyectos?status=en_curso", label: "En curso", active: status === "en_curso" },
          { href: "/proyectos?status=pausado", label: "Pausado", active: status === "pausado" },
          {
            href: "/proyectos?status=mantenimiento",
            label: "Mantenimiento",
            active: status === "mantenimiento",
          },
        ]}
      />
      <ProjectList
        canWrite={session.canWrite}
        projects={(projects ?? []).map((project) => {
          const client = project.clients as { name: string } | { name: string }[] | null;
          const clientName = Array.isArray(client) ? client[0]?.name : client?.name;
          return {
            id: project.id,
            code: project.code,
            ficha_url: project.ficha_url,
            status: project.status,
            clientName: clientName ?? "",
            workstreams: project.workstreams ?? [],
          };
        })}
      />
    </div>
  );
}
