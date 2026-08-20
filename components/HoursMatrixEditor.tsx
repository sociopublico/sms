"use client";

import { useMemo, useState, useTransition } from "react";
import {
  updatePersonMonthHours,
  updatePersonProjectBudget,
} from "@/app/(app)/hours-actions";
import { parseDurationToHours } from "@/lib/hours-sheet";
import { formatHoursClock } from "@/lib/toggl-import";

export type HoursEditorPerson = {
  id: string;
  name: string;
  estimatedHours: number;
  monthHours: number[];
};

export type HoursEditorProject = {
  key: string;
  client: string;
  project: string;
  projectId: string | null;
  linked: boolean;
  people: HoursEditorPerson[];
};

export function HoursMatrixEditor({
  months,
  projects,
  canEdit,
}: {
  months: { key: string; label: string }[];
  projects: HoursEditorProject[];
  canEdit: boolean;
}) {
  const [editActuals, setEditActuals] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!projects.length) {
    return (
      <p className="rounded-xl border border-line bg-paper px-4 py-8 text-center text-sm text-muted">
        No hay horas cargadas todavía. Importá el sheet desde Drive o Sync CSV.
      </p>
    );
  }

  function requestEnableActuals() {
    setConfirmOpen(true);
  }

  function confirmEnableActuals() {
    setConfirmOpen(false);
    setEditActuals(true);
  }

  function disableActuals() {
    setEditActuals(false);
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">Modificar horas de personas</p>
            <p className="text-sm text-muted">
              PROY siempre se puede editar. Las horas por mes idealmente vienen del sync; activá esto solo
              para correcciones manuales.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-navy">
            <span className="text-muted">{editActuals ? "On" : "Off"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={editActuals}
              disabled={pending}
              onClick={() => (editActuals ? disableActuals() : requestEnableActuals())}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                editActuals ? "bg-cyan" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  editActuals ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-auto rounded-xl border border-line bg-paper">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-line text-left text-muted">
              <th className="sticky left-0 z-20 bg-white px-3 py-2 font-medium">Cliente / Proyecto</th>
              <th className="px-3 py-2 font-medium">Equipo</th>
              <th className="px-3 py-2 font-medium tabular-nums">PROY</th>
              <th className="px-3 py-2 font-medium tabular-nums">REAL</th>
              <th className="px-3 py-2 font-medium tabular-nums">DIF</th>
              {months.map((month) => (
                <th key={month.key} className="whitespace-nowrap px-3 py-2 font-medium tabular-nums">
                  {month.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <ProjectBlock
                key={project.key}
                project={project}
                months={months}
                canEditProy={canEdit}
                canEditActuals={canEdit && editActuals}
                pending={pending}
                startTransition={startTransition}
                setError={setError}
              />
            ))}
          </tbody>
        </table>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hours-edit-title"
            className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-white p-6 shadow-lg"
          >
            <h2 id="hours-edit-title" className="text-lg font-medium text-ink">
              ¿Editar horas de personas a mano?
            </h2>
            <p className="text-sm text-muted">
              Lo ideal es que las horas mensuales se sincronicen desde Drive/Toggl. Si las editás acá,
              podés pisar o desalinearte del origen. ¿Seguro que querés activar la edición manual?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-line px-4 py-2 text-sm text-navy hover:bg-canvas"
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-navy"
                onClick={confirmEnableActuals}
              >
                Sí, editar a mano
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectBlock({
  project,
  months,
  canEditProy,
  canEditActuals,
  pending,
  startTransition,
  setError,
}: {
  project: HoursEditorProject;
  months: { key: string; label: string }[];
  canEditProy: boolean;
  canEditActuals: boolean;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  setError: (value: string | null) => void;
}) {
  const totals = useMemo(() => {
    let estimated = 0;
    let real = 0;
    for (const person of project.people) {
      estimated += person.estimatedHours;
      real += person.monthHours.reduce((a, b) => a + b, 0);
    }
    return { estimated, real };
  }, [project.people]);

  return (
    <>
      <tr className="border-t border-line bg-canvas/60">
        <td className="sticky left-0 z-[1] bg-canvas/95 px-3 py-2 font-medium text-ink">
          <span className="text-muted">{project.client || "—"}</span>
          <span className="text-muted"> · </span>
          {project.projectId ? (
            <a href={`/proyectos/${project.projectId}`} className="text-ink hover:text-cyan">
              {project.project}
            </a>
          ) : (
            <span>
              {project.project}
              <span className="ml-2 text-xs font-normal text-danger">sin vínculo SMS</span>
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-muted">{project.people.length}</td>
        <td className="px-3 py-2 tabular-nums text-ink">{formatHoursClock(totals.estimated) || "—"}</td>
        <td className="px-3 py-2 tabular-nums text-ink">{formatHoursClock(totals.real) || "—"}</td>
        <td className="px-3 py-2 tabular-nums text-muted" colSpan={1 + months.length} />
      </tr>
      {project.people.map((person) => (
        <PersonRow
          key={`${project.key}-${person.id}`}
          project={project}
          person={person}
          months={months}
          canEditProy={canEditProy}
          canEditActuals={canEditActuals}
          pending={pending}
          startTransition={startTransition}
          setError={setError}
        />
      ))}
    </>
  );
}

function PersonRow({
  project,
  person,
  months,
  canEditProy,
  canEditActuals,
  pending,
  startTransition,
  setError,
}: {
  project: HoursEditorProject;
  person: HoursEditorPerson;
  months: { key: string; label: string }[];
  canEditProy: boolean;
  canEditActuals: boolean;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  setError: (value: string | null) => void;
}) {
  const [proy, setProy] = useState(formatHoursClock(person.estimatedHours));
  const [monthValues, setMonthValues] = useState(
    person.monthHours.map((hours) => formatHoursClock(hours)),
  );

  const real = monthValues.reduce((sum, value) => {
    const parsed = parseDurationToHours(value);
    return sum + (parsed && parsed > 0 ? parsed : 0);
  }, 0);
  const proyNum = parseDurationToHours(proy) ?? 0;
  const dif = proyNum - real;

  function saveProy() {
    const hours = parseDurationToHours(proy);
    if (hours === null) {
      setError("PROY inválido. Usá formato 12:30 o 12.5");
      setProy(formatHoursClock(person.estimatedHours));
      return;
    }
    setError(null);
    startTransition(() => {
      void updatePersonProjectBudget({
        personId: person.id,
        rawClientLabel: project.client,
        rawProjectLabel: project.project,
        projectId: project.projectId,
        estimatedHours: hours,
      }).catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudo guardar PROY");
        setProy(formatHoursClock(person.estimatedHours));
      });
    });
  }

  function saveMonth(index: number) {
    const raw = monthValues[index] ?? "";
    const hours = raw.trim() === "" ? 0 : parseDurationToHours(raw);
    if (hours === null) {
      setError("Horas inválidas. Usá formato 12:30 o 12.5");
      setMonthValues((prev) => {
        const next = [...prev];
        next[index] = formatHoursClock(person.monthHours[index] ?? 0);
        return next;
      });
      return;
    }
    setError(null);
    startTransition(() => {
      void updatePersonMonthHours({
        personId: person.id,
        rawClientLabel: project.client,
        rawProjectLabel: project.project,
        projectId: project.projectId,
        monthStart: months[index].key,
        hours,
      }).catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudo guardar horas");
        setMonthValues((prev) => {
          const next = [...prev];
          next[index] = formatHoursClock(person.monthHours[index] ?? 0);
          return next;
        });
      });
    });
  }

  return (
    <tr className="border-t border-line/70">
      <td className="sticky left-0 z-[1] bg-paper px-3 py-1.5" />
      <td className="px-3 py-1.5 text-navy">{person.name}</td>
      <td className="px-3 py-1.5 tabular-nums text-ink">
        {canEditProy ? (
          <input
            value={proy}
            disabled={pending}
            onChange={(e) => setProy(e.target.value)}
            onBlur={saveProy}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-20 rounded-md border border-line bg-white px-2 py-1 text-right tabular-nums outline-none focus:border-cyan"
            placeholder="0:00"
          />
        ) : (
          proy || "—"
        )}
      </td>
      <td className="px-3 py-1.5 tabular-nums text-ink">{formatHoursClock(real) || "—"}</td>
      <td className="px-3 py-1.5 tabular-nums text-muted">{formatHoursClock(dif) || "—"}</td>
      {months.map((month, index) => (
        <td key={`${person.id}-${month.key}`} className="px-3 py-1.5 tabular-nums text-navy">
          {canEditActuals ? (
            <input
              value={monthValues[index] ?? ""}
              disabled={pending}
              onChange={(e) =>
                setMonthValues((prev) => {
                  const next = [...prev];
                  next[index] = e.target.value;
                  return next;
                })
              }
              onBlur={() => saveMonth(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-20 rounded-md border border-line bg-white px-2 py-1 text-right tabular-nums outline-none focus:border-cyan"
              placeholder="0:00"
            />
          ) : (
            monthValues[index] || ""
          )}
        </td>
      ))}
    </tr>
  );
}
