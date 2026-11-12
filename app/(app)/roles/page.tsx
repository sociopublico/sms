import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { upsertRole } from "../catalog-actions";
import { RoleRow } from "./RoleRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Siempre activo</th>
              {session.canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {(roles ?? []).map((role) => (
              <RoleRow
                key={role.id}
                canWrite={session.canWrite}
                role={{ id: role.id, name: role.name, always_on_duty: role.always_on_duty }}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
