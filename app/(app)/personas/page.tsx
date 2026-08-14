import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archivePerson, restorePerson, upsertPerson } from "../catalog-actions";

export default async function PeoplePage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: people }, { data: roles }] = await Promise.all([
    supabase
      .from("people")
      .select("id, display_name, deleted_at, person_roles(role_id, roles(name))")
      .order("display_name"),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Personas</h1>
        <p className="text-sm text-stone-600">
          Catálogo del equipo. La baja es lógica: deja de contar en la carga.
        </p>
      </div>

      {session.canWrite ? (
        <form action={upsertPerson} className="rounded border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-medium">Nueva persona</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              name="display_name"
              required
              placeholder="Nombre"
              className="rounded border border-stone-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {(roles ?? []).map((role) => (
                <label key={role.id} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="role_ids" value={role.id} />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <button className="mt-3 rounded bg-stone-900 px-3 py-1.5 text-sm text-white">Guardar</button>
        </form>
      ) : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-500">
            <th className="py-2">Persona</th>
            <th>Roles</th>
            <th>Estado</th>
            {session.canWrite ? <th /> : null}
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
              <tr key={person.id} className="border-b border-stone-100">
                <td className="py-2 font-medium">{person.display_name}</td>
                <td className="text-stone-600">{roleNames || "—"}</td>
                <td>{person.deleted_at ? "Baja" : "Activa"}</td>
                {session.canWrite ? (
                  <td className="text-right">
                    {person.deleted_at ? (
                      <form action={restorePerson.bind(null, person.id)}>
                        <button className="text-stone-700 underline">Restaurar</button>
                      </form>
                    ) : (
                      <form action={archivePerson.bind(null, person.id)}>
                        <button className="text-stone-700 underline">Dar de baja</button>
                      </form>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
