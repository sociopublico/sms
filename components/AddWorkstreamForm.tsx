import { createWorkstream } from "@/app/(app)/project-actions";
import { Button } from "@/components/ui/Button";
import { Field, fieldControlClass } from "@/components/ui/Field";

export function AddWorkstreamForm({ projectId }: { projectId: string }) {
  return (
    <form id="nuevo-workstream" action={createWorkstream} className="space-y-4 scroll-mt-24">
      <input type="hidden" name="project_id" value={projectId} />
      <Field label="Nombre">
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
        Agregar workstream
      </Button>
    </form>
  );
}
