import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateProject, updateProjectStatus, updateWorkstreamStatus } from "../../project-actions";
import { ProjectFields } from "@/components/ProjectFields";
import { ProjectHoursAliases } from "@/components/ProjectHoursAliases";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { FichaMissing, missingFicha } from "@/components/ui/FichaMissing";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusSelect } from "@/components/ui/StatusSelect";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: clients }, { data: aliases }, { data: unmatchedRows }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, code, ficha_url, kind, status, client_id, clients(name), workstreams(id, name, status, start_on, end_on)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("clients").select("id, name").order("name"),
      supabase
        .from("project_aliases")
        .select("id, alias, client_hint")
        .eq("project_id", id)
        .order("alias"),
      supabase
        .from("time_entries")
        .select("raw_client_label, raw_project_label")
        .is("project_id", null)
        .limit(2000),
    ]);
  if (!project) notFound();
  const client = project.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(client) ? client[0]?.name : client?.name;

  const unmatchedMap = new Map<
    string,
    { rawClientLabel: string; rawProjectLabel: string; entryCount: number }
  >();
  for (const row of unmatchedRows ?? []) {
    const key = `${row.raw_client_label}\0${row.raw_project_label}`;
    const prev = unmatchedMap.get(key);
    if (prev) prev.entryCount += 1;
    else {
      unmatchedMap.set(key, {
        rawClientLabel: row.raw_client_label,
        rawProjectLabel: row.raw_project_label,
        entryCount: 1,
      });
    }
  }
  const unmatched = [...unmatchedMap.values()];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        kicker={clientName}
        title={project.code}
        actions={
          <div className="flex items-center gap-2">
            {missingFicha(project.ficha_url, project.code) ? <FichaMissing /> : null}
            <StatusSelect
              value={project.status}
              canWrite={session.canWrite}
              onChange={updateProjectStatus.bind(null, project.id)}
            />
          </div>
        }
      />
      {session.canWrite ? (
        <Card className="p-6">
          <form action={updateProject} className="space-y-4">
            <input type="hidden" name="id" value={project.id} />
            <ProjectFields
              clients={clients ?? []}
              defaultKind={project.kind}
              defaultClientId={project.client_id}
              defaultCode={project.code}
              defaultFichaUrl={project.ficha_url ?? ""}
              codeRequired
            />
            <Field label="Estado">
              <select name="status" defaultValue={project.status} className={fieldControlClass}>
                <option value="en_curso">En curso</option>
                <option value="pausado">Pausado</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </Field>
            <Button type="submit" variant="primary">
              Guardar
            </Button>
          </form>
        </Card>
      ) : (
        <p className="text-sm text-muted">{project.ficha_url || "Sin ficha"}</p>
      )}

      <ProjectHoursAliases
        projectId={project.id}
        canWrite={session.canWrite}
        aliases={(aliases ?? []).map((row) => ({
          id: row.id,
          alias: row.alias,
          clientHint: row.client_hint,
        }))}
        unmatched={unmatched}
      />

      <section>
        <h2 className="mb-3 text-lg font-medium text-ink">Workstreams</h2>
        <ul className="space-y-2">
          {(project.workstreams ?? []).map((ws) => (
            <li key={ws.id}>
              <Card className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <Link href={`/workstreams/${ws.id}`} className="font-medium text-ink hover:text-cyan">
                  {ws.name}
                </Link>
                <StatusSelect
                  value={ws.status}
                  canWrite={session.canWrite}
                  onChange={updateWorkstreamStatus.bind(null, ws.id)}
                />
                <span className="text-muted">
                  {ws.start_on ?? "—"} → {ws.end_on ?? "—"}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
