"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { archiveRole, upsertRole } from "../catalog-actions";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";

export function RoleRow({
  role,
  canWrite,
}: {
  role: { id: string; name: string; always_on_duty: boolean };
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(role.always_on_duty);
  const [pending, startTransition] = useTransition();
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setValue(role.always_on_duty);
    setEditing(false);
  }, [role.always_on_duty]);

  useEffect(() => {
    if (editing) selectRef.current?.focus();
  }, [editing]);

  function cancel() {
    setValue(role.always_on_duty);
    setEditing(false);
  }

  function choose(next: boolean) {
    setValue(next);
    if (next === role.always_on_duty) {
      setEditing(false);
      return;
    }
    const formData = new FormData();
    formData.set("id", role.id);
    formData.set("name", role.name);
    if (next) formData.set("always_on_duty", "on");
    startTransition(async () => {
      try {
        await upsertRole(formData);
        setEditing(false);
      } catch {
        setValue(role.always_on_duty);
      }
    });
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3 font-medium text-ink">{role.name}</td>
      <td className="px-4 py-3">
        {editing ? (
          <select
            ref={selectRef}
            aria-label={`Siempre activo para ${role.name}`}
            disabled={pending}
            value={value ? "si" : "no"}
            onChange={(event) => choose(event.target.value === "si")}
            className="rounded-xl border border-line bg-paper px-3 py-1.5 text-sm text-ink focus:border-cyan scheme-light disabled:opacity-60"
          >
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        ) : (
          <Badge status={value ? "en_curso" : "pausado"}>{value ? "Sí" : "No"}</Badge>
        )}
      </td>
      {canWrite ? (
        <td className="px-4 py-3 text-right">
          <div className="inline-flex items-center justify-end">
            <button
              type="button"
              aria-label={editing ? `Cancelar edición de ${role.name}` : `Editar ${role.name}`}
              title={editing ? "Cancelar" : "Editar"}
              disabled={pending}
              onClick={() => (editing ? cancel() : setEditing(true))}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-canvas disabled:opacity-50 ${
                editing ? "text-cyan" : "text-muted hover:text-navy"
              }`}
            >
              <PencilIcon />
            </button>
            <ConfirmDelete label={role.name} action={archiveRole.bind(null, role.id)} />
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      <path strokeLinecap="round" d="M12 20h9" />
    </svg>
  );
}
