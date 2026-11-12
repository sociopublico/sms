import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { renamePerson, setPersonHidden, upsertPerson } from "../catalog-actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";

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
        description="El nombre es el que se ve en timeline, carga y el menú. Ocultar a alguien lo saca de esas vistas, sin borrarlo del catálogo."
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
            <SubmitButton className="mt-4">Guardar</SubmitButton>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
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
                    {session.canWrite ? (
                      <form action={renamePerson.bind(null, person.id)} className="flex flex-wrap items-center gap-2">
                        <input
                          name="display_name"
                          required
                          defaultValue={person.display_name}
                          aria-label={`Nombre de ${person.display_name}`}
                          className={`${fieldControlClass} max-w-56`}
                        />
                        <button type="submit" className="text-sm text-navy hover:text-cyan">
                          Guardar
                        </button>
                        {person.hidden ? <Badge status="pausado">oculta</Badge> : null}
                      </form>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {person.display_name}
                        {person.hidden ? <Badge status="pausado">oculta</Badge> : null}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{roleNames || "—"}</td>
                  {session.canWrite ? (
                    <td className="px-4 py-3 text-right">
                      {person.hidden ? (
                        <form action={setPersonHidden.bind(null, person.id, false)}>
                          <button type="submit" className="text-sm text-navy hover:text-cyan">
                            Mostrar
                          </button>
                        </form>
                      ) : (
                        <ConfirmDelete
                          label={person.display_name}
                          title={`¿Ocultar a ${person.display_name}?`}
                          description="Desaparece de timeline, workload y menús. No se borra del catálogo."
                          confirmLabel="Ocultar"
                          triggerLabel="Ocultar"
                          triggerClassName="text-sm text-navy hover:text-cyan"
                          action={setPersonHidden.bind(null, person.id, true)}
                        />
                      )}
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
