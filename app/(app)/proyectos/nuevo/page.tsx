import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { createProjectAndWorkstream } from "../../project-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function NewProjectPage() {
  const session = await requireSession();
  if (!session.canWrite) {
    return <p className="text-muted">No tenés permiso para crear proyectos.</p>;
  }
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, code, clients(name)")
    .order("code");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Nuevo workstream"
        description="La ficha es opcional. Si no hay ID, se genera uno provisional SIN-FICHA."
      />
      <Card className="p-6">
        <form action={createProjectAndWorkstream} className="space-y-4">
          <Field label="Colgar de un proyecto existente">
            <select name="existing_project_id" className={fieldControlClass}>
              <option value="">Crear proyecto nuevo</option>
              {(projects ?? []).map((p) => {
                const client = p.clients as { name: string } | { name: string }[] | null;
                const clientName = Array.isArray(client) ? client[0]?.name : client?.name;
                return (
                  <option key={p.id} value={p.id}>
                    {p.code} · {clientName}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="Cliente (si es proyecto nuevo)">
            <input name="client_name" className={fieldControlClass} />
          </Field>
          <Field label="ID de contrato / ficha">
            <input name="code" placeholder="Opcional" className={fieldControlClass} />
          </Field>
          <Field label="URL de ficha">
            <input name="ficha_url" placeholder="Opcional" className={fieldControlClass} />
          </Field>
          <Field label="Tipo">
            <select name="kind" className={fieldControlClass}>
              <option value="client">Cliente</option>
              <option value="internal">Interno</option>
            </select>
          </Field>
          <Field label="Workstream">
            <input name="workstream_name" required className={fieldControlClass} />
          </Field>
          <Field label="Estado">
            <select name="status" className={fieldControlClass}>
              <option value="en_curso">En curso</option>
              <option value="pausado">Pausado</option>
              <option value="mantenimiento">Mantenimiento (12 meses)</option>
            </select>
          </Field>
          <Button type="submit" variant="primary">
            Crear
          </Button>
        </form>
      </Card>
    </div>
  );
}
