"use client";

import { useState } from "react";
import Link from "next/link";
import { updateProjectStatus, updateWorkstreamStatus } from "@/app/(app)/project-actions";
import { AngleIcon } from "@/components/ui/AngleIcon";
import { Card } from "@/components/ui/Card";
import { FichaMissing, missingFicha } from "@/components/ui/FichaMissing";
import { StatusSelect } from "@/components/ui/StatusSelect";

export type ProjectListItem = {
  id: string;
  code: string;
  ficha_url: string | null;
  status: string;
  clientName: string;
  workstreams: { id: string; name: string; status: string }[];
};

const EXPANDED_KEY = "proyectos-expanded-projects";

function loadExpanded(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(EXPANDED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function ProjectList({
  projects,
  canWrite,
}: {
  projects: ProjectListItem[];
  canWrite: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded);

  function persist(next: Set<string>) {
    sessionStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
    setExpanded(next);
  }

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persist(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <button type="button" className="text-cyan hover:underline" onClick={() => persist(new Set(projects.map((project) => project.id)))}>
          Abrir todos
        </button>
        <span className="text-line">·</span>
        <button type="button" className="text-cyan hover:underline" onClick={() => persist(new Set())}>
          Cerrar todos
        </button>
      </div>
      {projects.map((project) => {
        const open = expanded.has(project.id);
        const count = project.workstreams.length;
        return (
          <Card key={project.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={open ? "Ocultar workstreams" : "Ver workstreams"}
                  onClick={() => toggle(project.id)}
                  className="mt-1 text-muted hover:text-cyan"
                >
                  <AngleIcon direction={open ? "down" : "right"} />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/proyectos/${project.id}`} className="font-medium text-ink hover:text-cyan">
                      {project.code}
                    </Link>
                    {missingFicha(project.ficha_url, project.code) ? (
                      <FichaMissing href={`/proyectos/${project.id}`} />
                    ) : null}
                  </div>
                  <button type="button" onClick={() => toggle(project.id)} className="mt-1 block text-left">
                    <p className="text-sm text-muted">{project.clientName}</p>
                    {open ? null : (
                      <p className="mt-1 text-sm text-muted">
                        {count} {count === 1 ? "workstream" : "workstreams"}
                      </p>
                    )}
                  </button>
                </div>
              </div>
              <StatusSelect
                value={project.status}
                canWrite={canWrite}
                onChange={updateProjectStatus.bind(null, project.id)}
              />
            </div>
            {open ? (
              <ul className="mt-3 ml-6 space-y-1.5 border-l border-line pl-4 text-sm">
                {project.workstreams.map((ws) => (
                  <li key={ws.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/workstreams/${ws.id}`} className="hover:text-cyan">
                      {ws.name}
                    </Link>
                    <StatusSelect
                      value={ws.status}
                      canWrite={canWrite}
                      onChange={updateWorkstreamStatus.bind(null, ws.id)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
