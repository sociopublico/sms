"use client";

import { useState, type ReactNode } from "react";
import { updateProject } from "@/app/(app)/project-actions";
import {
  ProjectContractFields,
  type ProjectContractValues,
} from "@/components/ProjectContractFields";
import { ProjectFields } from "@/components/ProjectFields";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";

function dash(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function formatDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function billingLabel(value: string | null | undefined) {
  if (value === "spuy") return "SPUY";
  if (value === "spar") return "SPAR";
  return "—";
}

function kindLabel(kind: string) {
  if (kind === "client") return "Cliente";
  if (kind === "internal") return "Interno";
  return kind;
}

function UrlOrDash({ href }: { href: string | null | undefined }) {
  const value = href?.trim();
  if (!value) return "—";
  return (
    <a
      href={value}
      className="break-all text-muted underline-offset-2 hover:text-cyan hover:underline"
      target="_blank"
      rel="noreferrer"
    >
      {value}
    </a>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{value}</dd>
    </div>
  );
}

export type ProjectEditorValues = ProjectContractValues & {
  kind: string;
  client_id: string | null;
  client_name: string | null;
  name: string | null;
  code: string;
  ficha_url: string | null;
  status: string;
};

export function ProjectEditor({
  projectId,
  canWrite,
  clients,
  values,
  detailsOpenByDefault = false,
}: {
  projectId: string;
  canWrite: boolean;
  clients: { id: string; name: string }[];
  values: ProjectEditorValues;
  detailsOpenByDefault?: boolean;
}) {
  const [open, setOpen] = useState(detailsOpenByDefault);
  const [editing, setEditing] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          title="Detalles del proyecto"
          hint="Datos de contrato, fechas y links."
        />
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button
            type="button"
            variant="ghost"
            aria-expanded={open}
            onClick={() => {
              setOpen((value) => !value);
              if (open) setEditing(false);
            }}
          >
            {open ? "Ocultar detalles" : "Ver detalles"}
          </Button>
          {open && canWrite && !editing ? (
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
              Editar
            </Button>
          ) : null}
        </div>
      </div>

      {open ? (
        editing && canWrite ? (
          <Card className="p-6">
            <form
              action={async (formData) => {
                await updateProject(formData);
                setEditing(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={projectId} />
              <input type="hidden" name="status" value={values.status} />
              <ProjectFields
                clients={clients}
                defaultKind={values.kind}
                defaultClientId={values.client_id ?? ""}
                defaultName={values.name ?? ""}
                defaultCode={values.code}
                defaultContractSignedOn={values.contract_signed_on ?? ""}
                defaultFichaUrl={values.ficha_url ?? ""}
                codeRequired
              />
              <ProjectContractFields defaults={values} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary">
                  Guardar
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="p-6">
            <dl className="space-y-3">
              <DetailRow label="Nombre del proyecto" value={dash(values.name)} />
              <DetailRow label="Tipo" value={kindLabel(values.kind)} />
              <DetailRow
                label="Cliente"
                value={values.kind === "internal" ? "Interno" : dash(values.client_name)}
              />
              <DetailRow label="Fecha de firma" value={formatDay(values.contract_signed_on)} />
              <DetailRow label="ID de contrato" value={dash(values.code)} />
              <DetailRow label="Ficha" value={dash(values.ficha_url)} />
              <DetailRow label="Partner" value={dash(values.partner)} />
              <DetailRow label="Propuesta" value={<UrlOrDash href={values.proposal_url} />} />
              <DetailRow label="Carpeta general" value={<UrlOrDash href={values.drive_folder_url} />} />
              <DetailRow label="Duración prevista" value={dash(values.planned_duration)} />
              <DetailRow label="Kickoff" value={formatDay(values.kickoff_on)} />
              <DetailRow label="Finalización (contrato)" value={formatDay(values.end_on)} />
              <DetailRow label="Finalización real" value={formatDay(values.actual_end_on)} />
              <DetailRow label="Agenda de pagos" value={dash(values.payment_schedule)} />
              <DetailRow label="Punto de cobro" value={billingLabel(values.billing_point)} />
            </dl>
          </Card>
        )
      ) : null}
    </section>
  );
}
