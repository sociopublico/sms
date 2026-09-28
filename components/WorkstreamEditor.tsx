"use client";

import { useState } from "react";
import { updateWorkstream } from "@/app/(app)/project-actions";
import { STATUS_LABEL, STATUS_OPTIONS } from "@/lib/dates";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldControlClass } from "@/components/ui/Field";

export function WorkstreamEditor({
  workstreamId,
  name,
  status,
  canWrite,
}: {
  workstreamId: string;
  name: string;
  status: string;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge status={status}>{STATUS_LABEL[status] ?? status}</Badge>
        {canWrite ? (
          <Button type="button" variant="ghost" onClick={() => setEditing((value) => !value)}>
            {editing ? "Cerrar" : "Editar workstream"}
          </Button>
        ) : null}
      </div>

      {editing && canWrite ? (
        <Card className="p-5">
          <form
            action={async (formData) => {
              await updateWorkstream(formData);
              setEditing(false);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="id" value={workstreamId} />
            <Field label="Nombre">
              <input name="name" required defaultValue={name} className={fieldControlClass} />
            </Field>
            <Field label="Estado">
              <select name="status" defaultValue={status} className={fieldControlClass}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {STATUS_LABEL[option]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary">
                Guardar
              </Button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="cursor-pointer text-sm text-navy hover:text-cyan"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
