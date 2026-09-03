import { createProject } from "../../project-actions";
import { ProjectFields } from "@/components/ProjectFields";
import { Button } from "@/components/ui/Button";
import { Field, fieldControlClass } from "@/components/ui/Field";

export function NewProjectForm({ clients }: { clients: { id: string; name: string }[] }) {
  return (
    <form action={createProject} className="space-y-4">
      <ProjectFields clients={clients} requireKindChoice />
      <Field label="Estado">
        <select name="status" className={fieldControlClass}>
          <option value="en_curso">En curso</option>
          <option value="pausado">Pausado</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="finalizado">Finalizado</option>
        </select>
      </Field>
      <Button type="submit" variant="primary">
        Crear proyecto
      </Button>
    </form>
  );
}
