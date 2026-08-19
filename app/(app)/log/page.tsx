import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AuditDetail } from "./AuditDetail";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";

const ACTION_LABEL: Record<string, string> = {
  "page.view": "Vio página",
  "users.set_role": "Cambió permiso",
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
};

function actionLabel(action: string) {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  if (action.startsWith("db.insert.")) return `DB insertó ${action.slice("db.insert.".length)}`;
  if (action.startsWith("db.update.")) return `DB actualizó ${action.slice("db.update.".length)}`;
  if (action.startsWith("db.delete.")) return `DB borró ${action.slice("db.delete.".length)}`;
  return action;
}

function roleLabel(role: string | null) {
  if (role === "admin") return "Admin";
  if (role === "pm") return "Editor";
  if (role === "member") return "Lector";
  return role ?? "—";
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
    <div className="space-y-6">
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
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Cuando</th>
              <th className="px-4 py-3 font-medium">Quién</th>
              <th className="px-4 py-3 font-medium">Acción</th>
              <th className="px-4 py-3 font-medium">Recurso</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
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
                  <td className="whitespace-nowrap px-4 py-3 text-navy">
                    {new Date(event.at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{event.actor_email ?? "—"}</div>
                    <div className="text-muted">{roleLabel(event.actor_role)}</div>
                  </td>
                  <td className="px-4 py-3 text-navy">
                    {actionLabel(event.action)}
                    {event.path ? <div className="text-muted">{event.path}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {event.resource_type ?? "—"}
                    {event.resource_id ? <div className="truncate font-mono text-xs">{event.resource_id}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <AuditDetail payload={event.payload} error={event.error} />
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
