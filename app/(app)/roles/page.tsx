import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteRole, upsertRole } from "../catalog-actions";

export default async function RolesPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: roles } = await supabase.from("roles").select("*").order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
        <p className="text-sm text-stone-600">
          PM y Supervisión pueden marcarse como siempre activos: cuentan +1 si hay cualquier tarea esa
          semana.
        </p>
      </div>
      {session.canWrite ? (
        <form action={upsertRole} className="flex flex-wrap items-end gap-3 rounded border border-stone-200 bg-white p-4">
          <label className="text-sm">
            Nombre
            <input name="name" required className="mt-1 block rounded border border-stone-300 px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="always_on_duty" />
            Siempre activo (PM / Supervisión)
          </label>
          <button className="rounded bg-stone-900 px-3 py-2 text-sm text-white">Agregar</button>
        </form>
      ) : null}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-500">
            <th className="py-2">Rol</th>
            <th>Siempre activo</th>
            {session.canWrite ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {(roles ?? []).map((role) => (
            <tr key={role.id} className="border-b border-stone-100">
              <td className="py-2">{role.name}</td>
              <td>{role.always_on_duty ? "Sí" : "No"}</td>
              {session.canWrite ? (
                <td className="text-right">
                  <form action={deleteRole.bind(null, role.id)}>
                    <button className="underline">Borrar</button>
                  </form>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
