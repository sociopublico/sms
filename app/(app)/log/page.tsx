import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  collectAuditIds,
  formatAuditPayload,
  formatLogWhen,
  type AuditLookups,
} from "@/lib/audit-format";
import { AuditDetail } from "./AuditDetail";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";

const ACTION_LABEL: Record<string, string> = {
  "page.view": "Vio página",
  "users.set_role": "Cambió permiso",
  "users.add_user": "Sumó usuario",
  "users.add_editor": "Invitó editor",
  "catalog.upsert_person": "Guardó persona",
  "catalog.set_person_hidden": "Ocultó/mostró persona",
  "catalog.upsert_role": "Guardó rol",
  "catalog.archive_role": "Archivó rol",
  "catalog.upsert_task": "Guardó tarea",
  "catalog.archive_task": "Archivó tarea",
  "projects.create_workstream": "Creó workstream",
  "projects.update": "Editó proyecto",
  "projects.update_status": "Cambió status de proyecto",
  "workstreams.update": "Editó workstream",
  "workstreams.update_status": "Cambió status de workstream",
  "workstreams.add_assignment": "Asignó persona",
  "workstreams.remove_assignment": "Quitó asignación",
  "timeline.set_week_tasks": "Editó timeline",
  "drive.connect": "Conectó Google Drive",
  "drive.disconnect": "Desconectó Google Drive",
};

const TABLE_LABEL: Record<string, string> = {
  timeline_week_tasks: "tarea del timeline",
  timeline_weeks: "semana del timeline",
  assignments: "asignación",
  workstreams: "workstream",
  projects: "proyecto",
  clients: "cliente",
  people: "persona",
  roles: "rol",
  tasks: "tarea",
  profiles: "usuario",
  editor_emails: "editor",
  admin_emails: "admin",
  app_emails: "usuario",
  person_roles: "rol de persona",
  task_roles: "rol de tarea",
};

function actionLabel(action: string) {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const match = action.match(/^db\.(insert|update|delete)\.(.+)$/);
  if (match) {
    const verb = match[1] === "insert" ? "Agregó" : match[1] === "update" ? "Actualizó" : "Borró";
    return `${verb} ${TABLE_LABEL[match[2]] ?? match[2]}`;
  }
  return action;
}

function roleLabel(role: string | null) {
  if (role === "admin") return "Admin";
  if (role === "pm") return "Editor";
  if (role === "member") return "Lector";
  return role ?? "—";
}

async function loadLookups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payloads: unknown[],
): Promise<AuditLookups> {
  const ids = collectAuditIds(payloads);
  const empty: AuditLookups = {
    tasks: {},
    people: {},
    roles: {},
    clients: {},
    projects: {},
    workstreams: {},
    weeks: {},
  };
  const [tasks, people, roles, clients, projects, workstreams, weeks] = await Promise.all([
    ids.tasks.size
      ? supabase.from("tasks").select("id, name").in("id", [...ids.tasks])
      : Promise.resolve({ data: [] }),
    ids.people.size
      ? supabase.from("people").select("id, display_name").in("id", [...ids.people])
      : Promise.resolve({ data: [] }),
    ids.roles.size
      ? supabase.from("roles").select("id, name").in("id", [...ids.roles])
      : Promise.resolve({ data: [] }),
    ids.clients.size
      ? supabase.from("clients").select("id, name").in("id", [...ids.clients])
      : Promise.resolve({ data: [] }),
    ids.projects.size
      ? supabase.from("projects").select("id, code").in("id", [...ids.projects])
      : Promise.resolve({ data: [] }),
    ids.workstreams.size
      ? supabase.from("workstreams").select("id, name").in("id", [...ids.workstreams])
      : Promise.resolve({ data: [] }),
    ids.weeks.size
      ? supabase
          .from("timeline_weeks")
          .select("id, week_start, workstreams(name, projects(code))")
          .in("id", [...ids.weeks])
      : Promise.resolve({ data: [] }),
  ]);

  for (const row of tasks.data ?? []) empty.tasks[row.id] = row.name;
  for (const row of people.data ?? []) empty.people[row.id] = row.display_name;
  for (const row of roles.data ?? []) empty.roles[row.id] = row.name;
  for (const row of clients.data ?? []) empty.clients[row.id] = row.name;
  for (const row of projects.data ?? []) empty.projects[row.id] = row.code;
  for (const row of workstreams.data ?? []) empty.workstreams[row.id] = row.name;
  for (const row of weeks.data ?? []) {
    const ws = row.workstreams as
      | { name: string; projects: { code: string } | { code: string }[] }
      | { name: string; projects: { code: string } | { code: string }[] }[]
      | null;
    const workstream = Array.isArray(ws) ? ws[0] : ws;
    const project = workstream?.projects;
    const projectCode = Array.isArray(project) ? project[0]?.code : project?.code;
    empty.weeks[row.id] = {
      start: row.week_start,
      workstream: workstream?.name,
      project: projectCode,
    };
  }
  return empty;
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; user?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const { kind, user, from, to } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_events")
    .select("id, at, actor_email, actor_role, action, path, resource_type, resource_id, payload, ok, error")
    .order("at", { ascending: false })
    .limit(400);

  if (kind === "pages") query = query.eq("action", "page.view");
  else if (kind === "db") query = query.like("action", "db.%");
  else if (kind === "writes") query = query.not("action", "like", "db.%").neq("action", "page.view");
  if (user?.trim()) query = query.eq("actor_email", user.trim().toLowerCase());
  if (from) query = query.gte("at", `${from}T00:00:00`);
  if (to) query = query.lte("at", `${to}T23:59:59`);

  const { data: events, error } = await query;
  if (error) throw new Error(error.message);
  const lookups = await loadLookups(supabase, (events ?? []).map((event) => event.payload));

  const qs = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { kind, user, from, to, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const s = params.toString();
    return s ? `/log?${s}` : "/log";
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-6">
      <PageHeader
        title="Log"
        description="Cada visita y cada cambio queda acá. Solo lo ven los admin."
      />
      <FilterChips
        items={[
          { href: qs({ kind: undefined }), label: "Todo", active: !kind },
          { href: qs({ kind: "writes" }), label: "Acciones", active: kind === "writes" },
          { href: qs({ kind: "pages" }), label: "Páginas", active: kind === "pages" },
          { href: qs({ kind: "db" }), label: "Base de datos", active: kind === "db" },
        ]}
      />
      <Card className="p-5">
        <form className="flex flex-wrap items-end gap-3">
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          <Field label="Usuario" className="min-w-56">
            <input
              name="user"
              type="email"
              defaultValue={user ?? ""}
              placeholder="mail@sociopublico.com"
              className={fieldControlClass}
            />
          </Field>
          <Field label="Desde" className="w-40">
            <input name="from" type="date" defaultValue={from ?? ""} className={fieldControlClass} />
          </Field>
          <Field label="Hasta" className="w-40">
            <input name="to" type="date" defaultValue={to ?? ""} className={fieldControlClass} />
          </Field>
          <Button type="submit" variant="ghost">
            Filtrar
          </Button>
        </form>
      </Card>
      <Card>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="sticky top-16 z-20 border-b border-line bg-paper px-4 py-2.5 font-medium">Cuando</th>
              <th className="sticky top-16 z-20 border-b border-line bg-paper px-4 py-2.5 font-medium">Quién</th>
              <th className="sticky top-16 z-20 border-b border-line bg-paper px-4 py-2.5 font-medium">Acción</th>
              <th className="sticky top-16 z-20 border-b border-line bg-paper px-4 py-2.5 font-medium">Recurso</th>
              <th className="sticky top-16 z-20 border-b border-line bg-paper px-4 py-2.5 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-muted">
                  No hay eventos con esos filtros.
                </td>
              </tr>
            ) : (
              (events ?? []).map((event) => (
                <tr key={event.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-navy">{formatLogWhen(event.at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{event.actor_email ?? "—"}</div>
                    <div className="text-muted">{roleLabel(event.actor_role)}</div>
                  </td>
                  <td className="px-4 py-3 text-navy">
                    {actionLabel(event.action)}
                    {event.path ? <div className="text-muted">{event.path}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {TABLE_LABEL[event.resource_type ?? ""] ?? event.resource_type ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <AuditDetail fields={formatAuditPayload(event.payload, lookups)} error={event.error} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
