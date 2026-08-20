import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archiveRole, upsertRole } from "../catalog-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function RolesPage() {
  const session = await requireWriter();
  const supabase = await createClient();
  const { data: roles } = await supabase.from("roles").select("*").is("deleted_at", null).order("name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="PM y Supervisión pueden marcarse como siempre activos: cuentan +1 si hay cualquier tarea esa semana."
      />
      {session.canWrite ? (
        <Card className="p-5">
          <form action={upsertRole} className="flex flex-wrap items-end gap-4">
            <Field label="Nombre" className="min-w-56">
              <input name="name" required className={fieldControlClass} />
            </Field>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="always_on_duty" />
              Siempre activo (PM / Supervisión)
            </label>
            <Button type="submit" className="mb-0.5">
              Agregar
            </Button>
          </form>
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Siempre activo</th>
              {session.canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {(roles ?? []).map((role) => (
              <tr key={role.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{role.name}</td>
                <td className="px-4 py-3">
                  <Badge status={role.always_on_duty ? "en_curso" : "pausado"}>
                    {role.always_on_duty ? "Sí" : "No"}
                  </Badge>
                </td>
                {session.canWrite ? (
                  <td className="px-4 py-3 text-right">
                    <ConfirmDelete label={role.name} action={archiveRole.bind(null, role.id)} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
