"use client";

import { useState } from "react";
import { createProjectAndWorkstream } from "../../project-actions";
import { ProjectFields } from "@/components/ProjectFields";
import { Button } from "@/components/ui/Button";
import { Field, fieldControlClass } from "@/components/ui/Field";

export function NewWorkstreamForm({
  projects,
  clients,
}: {
  projects: { id: string; code: string; clientName: string }[];
  clients: { id: string; name: string }[];
}) {
  const [existingId, setExistingId] = useState("");
  const isExisting = Boolean(existingId);

  return (
    <form action={createProjectAndWorkstream} className="space-y-4">
      <Field label="Proyecto">
        <select
          name="existing_project_id"
          value={existingId}
          onChange={(event) => setExistingId(event.target.value)}
          className={fieldControlClass}
        >
          <option value="">Crear proyecto nuevo</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} · {project.clientName}
            </option>
          ))}
        </select>
      </Field>

      {isExisting ? null : (
        <ProjectFields clients={clients} requireKindChoice />
      )}

      <Field label="Workstream">
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
        Crear
      </Button>
    </form>
  );
}
