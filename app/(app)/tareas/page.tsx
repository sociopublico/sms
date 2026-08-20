import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archiveTask, upsertTask } from "../catalog-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function TasksPage() {
  const session = await requireWriter();
  const supabase = await createClient();
  const [{ data: tasks }, { data: roles }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, name, color, task_roles(role_id, roles(name))")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("roles").select("id, name").is("deleted_at", null).order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tareas × rol"
        description="El color pinta el Gantt. Los roles asociados son quienes se enteran esa semana. On hold no dispara ejecución."
      />
      {session.canWrite ? (
        <Card className="p-5">
          <form action={upsertTask} className="space-y-4">
            <Field label="Nueva tarea" className="max-w-sm">
              <input name="name" required placeholder="Nueva tarea" className={fieldControlClass} />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-navy">Color</p>
              <ColorSwatch />
            </div>
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
            <Button type="submit">Guardar</Button>
          </form>
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Tarea</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              {session.canWrite ? <th className="px-4 py-3" /> : null}
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
                <tr key={task.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-sm"
                      style={{ background: task.color }}
                    />
                    {task.name}
                  </td>
                  <td className="px-4 py-3 text-muted">{roleNames || "—"}</td>
                  {session.canWrite ? (
                    <td className="px-4 py-3 text-right">
                      <ConfirmDelete label={task.name} action={archiveTask.bind(null, task.id)} />
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
