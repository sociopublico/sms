"use client";

import { useRouter } from "next/navigation";
import { fieldControlClass } from "@/components/ui/Field";

type ProjectFilters = {
  status?: string;
  client?: string;
  ficha?: string;
  horas?: string;
};

function proyectosHref(params: ProjectFilters) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.client) search.set("client", params.client);
  if (params.ficha === "con" || params.ficha === "sin") search.set("ficha", params.ficha);
  if (params.horas === "con" || params.horas === "sin") search.set("horas", params.horas);
  const query = search.toString();
  return query ? `/proyectos?${query}` : "/proyectos";
}

export function ProjectClientFilter({
  clients,
  filters,
}: {
  clients: { id: string; name: string }[];
  filters: ProjectFilters;
}) {
  const router = useRouter();

  return (
    <label className="block min-w-[12rem] flex-1 text-sm text-navy sm:max-w-xs">
      <span className="mb-1 block font-medium">Cliente</span>
      <select
        value={filters.client ?? ""}
        className={fieldControlClass}
        onChange={(event) =>
          router.push(proyectosHref({ ...filters, client: event.target.value || undefined }))
        }
      >
        <option value="">Todos</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </label>
  );
}
