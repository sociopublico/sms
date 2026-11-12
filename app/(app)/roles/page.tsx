import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archiveRole, upsertRole } from "../catalog-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { AngleIcon } from "@/components/ui/AngleIcon";

type TaskOption = { id: string; name: string; color: string };

function TaskPicker({ tasks, selected }: { tasks: TaskOption[]; selected: Set<string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tasks.map((task) => (
        <label
          key={task.id}
          className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-sm"
        >
          <input type="checkbox" name="task_ids" value={task.id} defaultChecked={selected.has(task.id)} />
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: task.color }} />
          {task.name}
        </label>
      ))}
    </div>
  );
}

export default async function RolesPage() {
  const session = await requireWriter();
  const supabase = await createClient();
  const [{ data: roles }, { data: tasks }] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, always_on_duty, task_roles(task_id)")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("tasks").select("id, name, color").is("deleted_at", null).order("name"),
  ]);
  const taskOptions = (tasks ?? []) as TaskOption[];
  const taskName = new Map(taskOptions.map((task) => [task.id, task.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Cada rol puede tener tareas. PM y Supervisión pueden marcarse como siempre activos: cuentan +1 si hay cualquier tarea esa semana."
      />
      {session.canWrite ? (
        <Card className="p-5">
          <form action={upsertRole} className="space-y-4">
            <input type="hidden" name="sync_tasks" value="1" />
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Nombre" className="min-w-56">
                <input name="name" required className={fieldControlClass} />
              </Field>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" name="always_on_duty" />
                Siempre activo (PM / Supervisión)
              </label>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-navy">Tareas</p>
              <TaskPicker tasks={taskOptions} selected={new Set()} />
            </div>
            <Button type="submit">Agregar</Button>
          </form>
        </Card>
      ) : null}
      <div className="space-y-3">
        {(roles ?? []).map((role) => {
          const selected = new Set(
            (role.task_roles ?? []).map((link) => link.task_id).filter((id): id is string => Boolean(id)),
          );
          const names = [...selected].map((id) => taskName.get(id)).filter(Boolean);
          return (
            <Card key={role.id} className="overflow-hidden">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <AngleIcon direction="right" className="text-muted transition-transform group-open:rotate-90" />
                  <span className="font-medium text-ink">{role.name}</span>
                  <Badge status={role.always_on_duty ? "en_curso" : "pausado"}>
                    {role.always_on_duty ? "Siempre activo" : "Por tarea"}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    {names.length ? names.join(", ") : "Sin tareas"}
                  </span>
                </summary>
                {session.canWrite ? (
                  <form action={upsertRole} className="space-y-4 border-t border-line px-4 py-4">
                    <input type="hidden" name="id" value={role.id} />
                    <input type="hidden" name="sync_tasks" value="1" />
                    <div className="flex flex-wrap items-end gap-4">
                      <Field label="Nombre" className="min-w-56">
                        <input name="name" required defaultValue={role.name} className={fieldControlClass} />
                      </Field>
                      <label className="mb-2 flex items-center gap-2 text-sm">
                        <input type="checkbox" name="always_on_duty" defaultChecked={role.always_on_duty} />
                        Siempre activo (PM / Supervisión)
                      </label>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium text-navy">Tareas</p>
                      <TaskPicker tasks={taskOptions} selected={selected} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Button type="submit">Guardar</Button>
                      <ConfirmDelete label={role.name} action={archiveRole.bind(null, role.id)} />
                    </div>
                  </form>
                ) : null}
              </details>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
