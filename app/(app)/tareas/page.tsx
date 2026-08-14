import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteTask, upsertTask } from "../catalog-actions";

export default async function TasksPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: tasks }, { data: roles }] = await Promise.all([
    supabase.from("tasks").select("id, name, color, task_roles(role_id, roles(name))").order("name"),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tareas × rol</h1>
        <p className="text-sm text-stone-600">
          El color pinta el Gantt. Los roles asociados son quienes se enteran esa semana. On hold no
          dispara ejecución.
        </p>
      </div>
      {session.canWrite ? (
        <form action={upsertTask} className="space-y-3 rounded border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <input name="name" required placeholder="Nueva tarea" className="rounded border border-stone-300 px-3 py-2 text-sm" />
            <input name="color" type="color" defaultValue="#64748b" />
          </div>
          <div className="flex flex-wrap gap-2">
            {(roles ?? []).map((role) => (
              <label key={role.id} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="role_ids" value={role.id} />
                {role.name}
              </label>
            ))}
          </div>
          <button className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white">Guardar</button>
        </form>
      ) : null}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-500">
            <th className="py-2">Tarea</th>
            <th>Roles</th>
            {session.canWrite ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {(tasks ?? []).map((task) => {
            const roleNames = (task.task_roles ?? [])
              .map((tr) => {
                const rel = tr.roles as { name: string } | { name: string }[] | null;
                if (Array.isArray(rel)) return rel[0]?.name;
                return rel?.name;
              })
              .filter(Boolean)
              .join(", ");
            return (
              <tr key={task.id} className="border-b border-stone-100">
                <td className="py-2">
                  <span className="mr-2 inline-block h-3 w-3 rounded-sm" style={{ background: task.color }} />
                  {task.name}
                </td>
                <td className="text-stone-600">{roleNames || "—"}</td>
                {session.canWrite ? (
                  <td className="text-right">
                    <form action={deleteTask.bind(null, task.id)}>
                      <button className="underline">Borrar</button>
                    </form>
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
