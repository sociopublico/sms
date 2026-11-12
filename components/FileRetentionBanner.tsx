import Link from "next/link";
import { resolveFileRetention } from "@/app/(app)/file-retention-actions";
import {
  FILE_RETENTION_POLICY_URL,
  fileRetentionDueOn,
  formatDay,
  type FileRetentionProject,
} from "@/lib/file-retention";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function FileRetentionBanner({
  project,
  canResolve,
}: {
  project: FileRetentionProject;
  canResolve: boolean;
}) {
  const dueOn = fileRetentionDueOn(project.actual_end_on);
  const folderUrl = project.drive_folder_url?.trim() || null;

  return (
    <article className="rounded-xl border border-line bg-paper p-4 shadow-sm">
      <div className="min-w-0 space-y-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-orange">Retención pendiente</p>
          <p className="mt-1 text-base font-medium text-ink">
            <Link href={`/proyectos/${project.id}`} className="hover:text-cyan">
              {project.code}
            </Link>
          </p>
          {project.clientName ? <p className="text-xs text-muted">{project.clientName}</p> : null}
        </div>
        <p className="text-sm text-ink">
          Pasaron 90 días desde la finalización real ({formatDay(project.actual_end_on)}). El plazo de
          retención venció el {formatDay(dueOn)}. Ordená los archivos del proyecto según la política.
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <a
            href={FILE_RETENTION_POLICY_URL}
            target="_blank"
            rel="noreferrer"
            className="text-muted underline-offset-2 hover:text-cyan hover:underline"
          >
            Instrucciones de retención
          </a>
          {folderUrl ? (
            <a
              href={folderUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted underline-offset-2 hover:text-cyan hover:underline"
            >
              Carpeta Drive
            </a>
          ) : null}
        </p>
      </div>

      {canResolve ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <form action={resolveFileRetention.bind(null, project.id, "done")}>
            <Button type="submit" variant="ink">
              Ya ordené los archivos
            </Button>
          </form>
          <form action={resolveFileRetention.bind(null, project.id, "not_applicable")}>
            <Button type="submit" variant="ghost">
              No aplica
            </Button>
          </form>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">
          La PM del proyecto o un admin pueden marcar este aviso como hecho o no aplica.
        </p>
      )}
    </article>
  );
}

export function FileRetentionSection({
  title = "Retención de archivos",
  projects,
  canResolve,
  empty,
}: {
  title?: string;
  projects: FileRetentionProject[];
  canResolve: boolean;
  empty?: string;
}) {
  if (projects.length === 0) {
    if (!empty) return null;
    return (
      <section>
        <SectionHeading title={title} count={0} />
        <p className="text-sm text-muted">{empty}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <SectionHeading
        title={title}
        count={projects.length}
        hint="Más de 90 días desde la finalización real, pendientes de revisar archivos."
      />
      <ul className="space-y-3">
        {projects.map((project) => (
          <li key={project.id}>
            <FileRetentionBanner project={project} canResolve={canResolve} />
          </li>
        ))}
      </ul>
    </section>
  );
}
