"use client";

import { useState } from "react";
import { addAssignment, removeAssignment } from "@/app/(app)/project-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldControlClass } from "@/components/ui/Field";

export type TeamAssignment = {
  id: string;
  person_id: string;
  role_id: string;
  person_name: string;
  role_name: string;
};

export type TeamOption = {
  id: string;
  label: string;
};

type PersonGroup = {
  personId: string;
  personName: string;
  roles: { assignmentId: string; roleId: string; roleName: string }[];
};

function groupByPerson(assignments: TeamAssignment[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>();
  for (const asg of assignments) {
    const existing = map.get(asg.person_id);
    if (existing) {
      existing.roles.push({
        assignmentId: asg.id,
        roleId: asg.role_id,
        roleName: asg.role_name,
      });
    } else {
      map.set(asg.person_id, {
        personId: asg.person_id,
        personName: asg.person_name,
        roles: [
          {
            assignmentId: asg.id,
            roleId: asg.role_id,
            roleName: asg.role_name,
          },
        ],
      });
    }
  }
  return Array.from(map.values())
    .map((group) => ({
      ...group,
      roles: group.roles.slice().sort((a, b) => a.roleName.localeCompare(b.roleName, "es")),
    }))
    .sort((a, b) => a.personName.localeCompare(b.personName, "es"));
}

function RoleChip({
  roleName,
  canWrite,
  onRemove,
}: {
  roleName: string;
  canWrite: boolean;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink">
      {roleName}
      {canWrite && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer text-muted hover:text-danger"
          aria-label={`Quitar rol ${roleName}`}
          title="Quitar rol"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function WorkstreamTeam({
  workstreamId,
  canManage,
  assignments,
  people,
  roles,
}: {
  workstreamId: string;
  canManage: boolean;
  assignments: TeamAssignment[];
  people: TeamOption[];
  roles: TeamOption[];
}) {
  const [adding, setAdding] = useState(false);
  const groups = groupByPerson(assignments);

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-ink">Equipo</h2>

      {groups.length > 0 ? (
        <p className="mb-3 text-sm text-muted">
          <span className="font-medium text-navy">{groups.length}</span>{" "}
          {groups.length === 1 ? "persona" : "personas"}
        </p>
      ) : (
        <p className="mb-3 text-sm text-muted">Todavía no hay nadie asignado a este workstream.</p>
      )}

      {groups.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
          {groups.map((group) => (
            <li key={group.personId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <span className="min-w-[7rem] text-sm font-medium text-ink">{group.personName}</span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {group.roles.map((role) => (
                  <RoleChip
                    key={role.assignmentId}
                    roleName={role.roleName}
                    canWrite={canManage}
                    onRemove={
                      canManage
                        ? async () => {
                            await removeAssignment(role.assignmentId, workstreamId);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {canManage ? (
        <div className="mt-4">
          {adding ? (
            <Card className="p-6">
              <h3 className="mb-3 text-sm font-medium text-ink">Asignar persona</h3>
              <form action={addAssignment} className="space-y-4">
                <input type="hidden" name="workstream_id" value={workstreamId} />
                <Field label="Persona">
                  <select name="person_id" required className={fieldControlClass}>
                    <option value="">Elegir persona</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Rol">
                  <select name="role_id" required className={fieldControlClass}>
                    <option value="">Elegir rol</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="primary">
                    Asignar
                  </Button>
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="cursor-pointer text-sm text-navy hover:text-cyan"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </Card>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setAdding(true)} aria-expanded={false}>
              Asignar persona
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
