import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setPersonHidden, upsertPerson } from "../catalog-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function PeoplePage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: people }, { data: roles }] = await Promise.all([
    supabase
      .from("people")
      .select("id, display_name, hidden, person_roles(role_id, roles(name))")
      .is("deleted_at", null)
      .order("display_name"),
    supabase.from("roles").select("id, name").is("deleted_at", null).order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personas"
        description="Ocultar a alguien lo saca de Timeline y Workload, sin borrarlo del catálogo."
      />

      {session.canWrite ? (
        <Card className="p-5">
          <form action={upsertPerson}>
            <h2 className="text-sm font-medium text-ink">Nueva persona</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Field label="Nombre">
                <input name="display_name" required placeholder="Nombre" className={fieldControlClass} />
              </Field>
              <div>
                <p className="mb-1 text-sm font-medium text-navy">Roles</p>
                <div className="flex flex-wrap gap-2">
                  {(roles ?? []).map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-sm"
                    >
                      <input type="checkbox" name="role_ids" value={role.id} />
                      {role.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <Button type="submit" className="mt-4">
              Guardar
            </Button>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Persona</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              {session.canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((person) => {
              const roleNames = (person.person_roles ?? [])
                .map((pr) => {
                  const rel = pr.roles as { name: string } | { name: string }[] | null;
                  if (Array.isArray(rel)) return rel[0]?.name;
                  return rel?.name;
                })
                .filter(Boolean)
                .join(", ");
              return (
                <tr
                  key={person.id}
                  className={`border-b border-line last:border-0 ${person.hidden ? "bg-canvas/60" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    <span className="inline-flex items-center gap-2">
                      {person.display_name}
                      {person.hidden ? <Badge status="pausado">oculta</Badge> : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{roleNames || "—"}</td>
                  {session.canWrite ? (
                    <td className="px-4 py-3 text-right">
                      <form action={setPersonHidden.bind(null, person.id, !person.hidden)}>
                        <button type="submit" className="text-sm text-navy hover:text-cyan">
                          {person.hidden ? "Mostrar" : "Ocultar"}
                        </button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
