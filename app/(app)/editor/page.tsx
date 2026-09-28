import Link from "next/link";
import { redirect } from "next/navigation";
import { homePathForRole, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FileRetentionSection } from "@/components/FileRetentionBanner";
import { fetchPendingFileRetentionProjects } from "@/lib/file-retention-query";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";

type EditorProject = {
  id: string;
  code: string;
  clientName: string;
  workstreams: { id: string; name: string; status: string }[];
};

type UpcomingDeliverable = {
  id: string;
  description: string;
  delivery_on: string;
  kind: string;
  workstreamId: string;
  workstreamName: string;
  projectCode: string;
};

function todayInBuenosAires() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

function addDaysIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function formatDay(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export default async function EditorHomePage() {
  const session = await requireSession();
  if (session.appRole !== "pm") {
    redirect(homePathForRole(session.appRole));
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("person_id")
    .eq("id", session.id)
    .maybeSingle();

  const personId = profile?.person_id ?? null;
  let projects: EditorProject[] = [];
  let upcoming: UpcomingDeliverable[] = [];
  let retentionProjects: Awaited<ReturnType<typeof fetchPendingFileRetentionProjects>> = [];
  const canResolveRetention = true;

  if (personId) {
    const { data: pmRole } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "PM")
      .is("deleted_at", null)
      .maybeSingle();

    if (pmRole?.id) {
      const { data: rows } = await supabase
        .from("assignments")
        .select(
          "workstreams(id, name, status, projects(id, code, status, clients(name)))",
        )
        .eq("person_id", personId)
        .eq("role_id", pmRole.id);

      const byProject = new Map<string, EditorProject>();
      const pmWorkstreamIds: string[] = [];
      const pmProjectIds: string[] = [];
      const wsMeta = new Map<string, { name: string; projectCode: string }>();

      for (const row of rows ?? []) {
        const wsRel = row.workstreams as
          | {
              id: string;
              name: string;
              status: string;
              projects:
                | { id: string; code: string; status: string; clients: { name: string } | { name: string }[] | null }
                | { id: string; code: string; status: string; clients: { name: string } | { name: string }[] | null }[]
                | null;
            }
          | {
              id: string;
              name: string;
              status: string;
              projects:
                | { id: string; code: string; status: string; clients: { name: string } | { name: string }[] | null }
                | { id: string; code: string; status: string; clients: { name: string } | { name: string }[] | null }[]
                | null;
            }[]
          | null;

        const ws = Array.isArray(wsRel) ? wsRel[0] : wsRel;
        if (!ws) continue;

        const projectRel = ws.projects;
        const project = Array.isArray(projectRel) ? projectRel[0] : projectRel;
        if (!project) continue;

        pmProjectIds.push(project.id);

        if (project.status !== "en_curso") continue;

        const clientRel = project.clients;
        const clientName = Array.isArray(clientRel) ? clientRel[0]?.name : clientRel?.name;

        pmWorkstreamIds.push(ws.id);
        wsMeta.set(ws.id, { name: ws.name, projectCode: project.code });

        const existing = byProject.get(project.id);
        if (existing) {
          if (!existing.workstreams.some((w) => w.id === ws.id)) {
            existing.workstreams.push({ id: ws.id, name: ws.name, status: ws.status });
          }
        } else {
          byProject.set(project.id, {
            id: project.id,
            code: project.code,
            clientName: clientName ?? "",
            workstreams: [{ id: ws.id, name: ws.name, status: ws.status }],
          });
        }
      }

      projects = [...byProject.values()].sort((a, b) => a.code.localeCompare(b.code, "es"));
      retentionProjects = await fetchPendingFileRetentionProjects(supabase, {
        projectIds: [...new Set(pmProjectIds)],
      });

      if (pmWorkstreamIds.length > 0) {
        const today = todayInBuenosAires();
        const until = addDaysIso(today, 14);
        const { data: deliverableRows } = await supabase
          .from("deliverables")
          .select("id, description, delivery_on, kind, workstream_id")
          .in("workstream_id", pmWorkstreamIds)
          .is("deleted_at", null)
          .not("delivery_on", "is", null)
          .gte("delivery_on", today)
          .lte("delivery_on", until)
          .order("delivery_on", { ascending: true });

        upcoming = (deliverableRows ?? []).map((row) => {
          const meta = wsMeta.get(row.workstream_id);
          return {
            id: row.id,
            description: row.description,
            delivery_on: row.delivery_on as string,
            kind: row.kind,
            workstreamId: row.workstream_id,
            workstreamName: meta?.name ?? "—",
            projectCode: meta?.projectCode ?? "—",
          };
        });
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader title="Mis proyectos" titleClassName="font-bold" />

      {!personId ? (
        <p className="text-sm text-muted">
          Tu cuenta no está vinculada a una persona del catálogo. Pedile a un admin que lo haga en
          Usuarios.
        </p>
      ) : (
        <>
          <FileRetentionSection projects={retentionProjects} canResolve={canResolveRetention} />

          <section className="space-y-4">
            <SectionHeading
              title="Entregables próximos"
              count={upcoming.length}
              hint="Con fecha de entrega en los próximos 14 días."
            />
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">No hay entregables cercanos.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
                {upcoming.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/workstreams/${item.workstreamId}`}
                      className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3 transition-colors hover:bg-canvas/60"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-muted">
                          {item.projectCode}
                          {" · "}
                          {item.workstreamName}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-ink">{item.description}</p>
                      </div>
                      <time
                        dateTime={item.delivery_on}
                        className="shrink-0 text-base font-medium tabular-nums text-navy"
                      >
                        {formatDay(item.delivery_on)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="Proyectos en curso"
              count={projects.length}
              hint="Proyectos donde tenés el rol de staffing PM."
            />
            {projects.length === 0 ? (
              <p className="text-sm text-muted">No tenés proyectos en curso como PM.</p>
            ) : (
              <ul className="space-y-2">
                {projects.map((project) => (
                  <li key={project.id}>
                    <Card className="px-4 py-3">
                      <div>
                        <Link
                          href={`/proyectos/${project.id}`}
                          className="text-base font-medium text-ink hover:text-cyan"
                        >
                          {project.code}
                        </Link>
                        {project.clientName ? (
                          <p className="mt-0.5 text-xs text-muted">{project.clientName}</p>
                        ) : null}
                      </div>
                      {project.workstreams.length > 0 ? (
                        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2">
                          {project.workstreams.map((ws) => (
                            <li key={ws.id}>
                              <Link
                                href={`/workstreams/${ws.id}`}
                                className="text-xs text-muted hover:text-cyan"
                              >
                                {ws.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
