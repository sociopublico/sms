"use client";

import { useState } from "react";
import { ProjectClientFilter } from "@/components/ProjectClientFilter";
import { AngleIcon } from "@/components/ui/AngleIcon";
import { FilterChips } from "@/components/ui/FilterChips";
import { buttonClass } from "@/components/ui/Button";

type ProjectFilters = {
  status?: string;
  client?: string;
  ficha?: string;
  horas?: string;
};

type Chip = { href: string; label: string; active: boolean };

export function ProjectExtraFilters({
  clients,
  filters,
  fichaChips,
  horasChips,
}: {
  clients: { id: string; name: string }[];
  filters: ProjectFilters;
  fichaChips: Chip[];
  horasChips: Chip[];
}) {
  const activeCount = [filters.client, filters.ficha, filters.horas].filter(Boolean).length;
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`${buttonClass("ghost")} cursor-pointer gap-2`}
      >
        Filtros
        {activeCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan px-1.5 text-xs font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
        <AngleIcon direction={open ? "up" : "down"} className="opacity-70" />
      </button>
      {open ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <ProjectClientFilter clients={clients} filters={filters} />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-navy">Ficha</p>
            <FilterChips size="sm" items={fichaChips} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-navy">Label de horas</p>
            <FilterChips size="sm" items={horasChips} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
