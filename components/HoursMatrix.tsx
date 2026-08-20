export type HoursMatrixPerson = {
  id: string;
  name: string;
  proy: string;
  real: string;
  dif: string;
  months: string[];
};

export type HoursMatrixProject = {
  key: string;
  client: string;
  project: string;
  projectId: string | null;
  linked: boolean;
  estimatedLabel: string;
  realLabel: string;
  people: HoursMatrixPerson[];
};

export function HoursMatrix({
  months,
  projects,
}: {
  months: { key: string; label: string }[];
  projects: HoursMatrixProject[];
}) {
  if (!projects.length) {
    return (
      <p className="rounded-xl border border-line bg-paper px-4 py-8 text-center text-sm text-muted">
        No hay horas cargadas todavía. Importá el sheet desde Drive o Sync CSV.
      </p>
    );
  }

  return (
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
            <ProjectBlock key={project.key} project={project} monthCount={months.length} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectBlock({
  project,
  monthCount,
}: {
  project: HoursMatrixProject;
  monthCount: number;
}) {
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
        <td className="px-3 py-2 tabular-nums text-ink">{project.estimatedLabel || "—"}</td>
        <td className="px-3 py-2 tabular-nums text-ink">{project.realLabel || "—"}</td>
        <td className="px-3 py-2 tabular-nums text-muted" colSpan={1 + monthCount} />
      </tr>
      {project.people.map((person) => (
        <tr key={`${project.key}-${person.id}`} className="border-t border-line/70">
          <td className="sticky left-0 z-[1] bg-paper px-3 py-1.5" />
          <td className="px-3 py-1.5 text-navy">{person.name}</td>
          <td className="px-3 py-1.5 tabular-nums text-ink">{person.proy || "—"}</td>
          <td className="px-3 py-1.5 tabular-nums text-ink">{person.real || "—"}</td>
          <td className="px-3 py-1.5 tabular-nums text-muted">{person.dif || "—"}</td>
          {person.months.map((value, index) => (
            <td key={`${person.id}-${index}`} className="px-3 py-1.5 tabular-nums text-navy">
              {value || ""}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
