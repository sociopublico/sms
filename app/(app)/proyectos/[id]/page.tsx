import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateProjectStatus, updateWorkstreamStatus } from "../../project-actions";
import { AddWorkstreamSection } from "@/components/AddWorkstreamSection";
import { FileRetentionBanner } from "@/components/FileRetentionBanner";
import { ProjectEditor } from "@/components/ProjectEditor";
import { ProjectHoursAliases } from "@/components/ProjectHoursAliases";
import { isFileRetentionPending } from "@/lib/file-retention";
import { Card } from "@/components/ui/Card";
import { FichaMissing, missingFicha } from "@/components/ui/FichaMissing";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusSelect } from "@/components/ui/StatusSelect";

function formatDay(iso: string | null | undefined) {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function DocumentIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 ${className}`.trim()} aria-hidden>
      <path
        d="M4.5 2.5h5l2.5 2.5V13.5a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 2.5V5h2.5M6 8.5h4M6 11h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 ${className}`.trim()} aria-hidden>
      <path
        d="M2.5 4.5h4l1.25 1.5H13.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeaderLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: "document" | "folder";
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-cyan hover:underline"
      target="_blank"
      rel="noreferrer"
    >
      {icon === "document" ? <DocumentIcon /> : <FolderIcon />}
      {label}
    </a>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: clients }, { data: aliases }, { data: unmatchedRows }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, code, name, ficha_url, kind, status, client_id, partner, contract_signed_on, proposal_url, drive_folder_url, planned_duration, kickoff_on, end_on, actual_end_on, payment_schedule, billing_point, file_retention_resolution, clients(name), workstreams(id, name, status, start_on, end_on)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("clients").select("id, name").order("name"),
      supabase
        .from("project_aliases")
        .select("id, alias, client_hint")
        .eq("project_id", id)
        .order("alias"),
      supabase
        .from("time_entries")
        .select("raw_client_label, raw_project_label")
        .is("project_id", null)
        .limit(2000),
    ]);
  if (!project) notFound();
  const client = project.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(client) ? client[0]?.name : client?.name;

  const unmatchedMap = new Map<
    string,
    { rawClientLabel: string; rawProjectLabel: string; entryCount: number }
  >();
  for (const row of unmatchedRows ?? []) {
    const key = `${row.raw_client_label}\0${row.raw_project_label}`;
    const prev = unmatchedMap.get(key);
    if (prev) prev.entryCount += 1;
    else {
      unmatchedMap.set(key, {
        rawClientLabel: row.raw_client_label,
        rawProjectLabel: row.raw_project_label,
        entryCount: 1,
      });
    }
  }
  const unmatched = [...unmatchedMap.values()];

  const kickoffLabel = formatDay(project.kickoff_on);
  const endLabel = formatDay(project.end_on);
  const proposalUrl = project.proposal_url?.trim() || null;
  const folderUrl = project.drive_folder_url?.trim() || null;
  const headerLinks = [
    proposalUrl ? { href: proposalUrl, label: "Propuesta", icon: "document" as const } : null,
    folderUrl ? { href: folderUrl, label: "Carpeta general", icon: "folder" as const } : null,
  ].filter(Boolean) as { href: string; label: string; icon: "document" | "folder" }[];

  const retentionPending = isFileRetentionPending(
    project.actual_end_on,
    project.file_retention_resolution as "done" | "not_applicable" | null,
  );
  const canResolveRetention = session.appRole === "admin" || session.appRole === "pm";
  const workstreams = project.workstreams ?? [];

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <PageHeader
        kicker={
          <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-1.5 text-xs">
            <Link href="/proyectos" className="text-muted hover:text-cyan">
              Proyectos
            </Link>
            <span aria-hidden className="text-muted">
              /
            </span>
            <span className="text-muted">{project.name?.trim() || project.code}</span>
          </nav>
        }
        title={project.name?.trim() || project.code}
        titleClassName="font-bold"
        description={
          <div className="space-y-1">
            {clientName ? <p className="text-sm text-muted">{clientName}</p> : null}
            {kickoffLabel || endLabel ? (
              <p className="text-xs text-muted">
                {kickoffLabel ?? "Sin kickoff"} → {endLabel ?? "Sin fin"}
              </p>
            ) : null}
            {headerLinks.length > 0 ? (
              <p className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                {headerLinks.map((link) => (
                  <HeaderLink key={link.label} href={link.href} label={link.label} icon={link.icon} />
                ))}
              </p>
            ) : null}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {missingFicha(project.ficha_url) ? <FichaMissing /> : null}
            <StatusSelect
              value={project.status}
              canWrite={session.canWrite}
              onChange={updateProjectStatus.bind(null, project.id)}
            />
          </div>
        }
      />

      {retentionPending && project.actual_end_on ? (
        <FileRetentionBanner
          project={{
            id: project.id,
            code: project.code,
            actual_end_on: project.actual_end_on,
            drive_folder_url: project.drive_folder_url,
            clientName: clientName ?? null,
          }}
          canResolve={canResolveRetention}
        />
      ) : null}

      <ProjectEditor
        projectId={project.id}
        canWrite={session.canWrite}
        clients={clients ?? []}
        detailsOpenByDefault={session.appRole === "staff"}
        values={{
          kind: project.kind,
          client_id: project.client_id,
          client_name: clientName ?? null,
          name: project.name,
          code: project.code,
          ficha_url: project.ficha_url,
          status: project.status,
          partner: project.partner,
          contract_signed_on: project.contract_signed_on,
          proposal_url: project.proposal_url,
          drive_folder_url: project.drive_folder_url,
          planned_duration: project.planned_duration,
          kickoff_on: project.kickoff_on,
          end_on: project.end_on,
          actual_end_on: project.actual_end_on,
          payment_schedule: project.payment_schedule,
          billing_point: project.billing_point,
        }}
      />

      <ProjectHoursAliases
        projectId={project.id}
        canWrite={session.canWrite}
        aliases={(aliases ?? []).map((row) => ({
          id: row.id,
          alias: row.alias,
          clientHint: row.client_hint,
        }))}
        unmatched={unmatched}
      />

      <section className="space-y-4">
        <SectionHeading
          title="Workstreams"
          count={workstreams.length}
          hint="Líneas de trabajo del proyecto."
        />
        {workstreams.length === 0 ? (
          <p className="text-sm text-danger">Este proyecto todavía no tiene workstreams.</p>
        ) : (
          <ul className="space-y-2">
            {workstreams.map((ws) => (
              <li key={ws.id}>
                <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <Link
                    href={`/workstreams/${ws.id}`}
                    className="text-sm font-medium text-ink hover:text-cyan"
                  >
                    {ws.name}
                  </Link>
                  <StatusSelect
                    value={ws.status}
                    canWrite={session.canWrite}
                    onChange={updateWorkstreamStatus.bind(null, ws.id)}
                  />
                  <span className="text-xs text-muted">
                    {formatDay(ws.start_on) ?? "—"} → {formatDay(ws.end_on) ?? "—"}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {session.appRole === "admin" || session.appRole === "pm" ? (
          <AddWorkstreamSection projectId={project.id} />
        ) : null}
      </section>
    </div>
  );
}
