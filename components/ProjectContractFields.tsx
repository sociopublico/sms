"use client";

import { useState, type ReactNode } from "react";
import { Field, fieldControlClass } from "@/components/ui/Field";

export type ProjectContractValues = {
  partner: string | null;
  contract_signed_on: string | null;
  proposal_url: string | null;
  drive_folder_url: string | null;
  planned_duration: string | null;
  kickoff_on: string | null;
  end_on: string | null;
  actual_end_on: string | null;
  payment_schedule: string | null;
  billing_point: string | null;
};

export function ProjectContractFields({ defaults }: { defaults?: Partial<ProjectContractValues> }) {
  const initialEnd = defaults?.end_on ?? "";
  const initialActual = defaults?.actual_end_on ?? initialEnd;
  const [endOn, setEndOn] = useState(initialEnd);
  const [actualEndOn, setActualEndOn] = useState(initialActual);
  const [actualTouched, setActualTouched] = useState(
    Boolean(defaults?.actual_end_on && defaults.actual_end_on !== (defaults.end_on ?? null)),
  );

  return (
    <>
      <Field label="Partner">
        <input name="partner" defaultValue={defaults?.partner ?? ""} className={fieldControlClass} />
      </Field>
      <Field label="Fecha de firma del contrato">
        <input
          name="contract_signed_on"
          type="date"
          defaultValue={defaults?.contract_signed_on ?? ""}
          className={fieldControlClass}
        />
      </Field>
      <Field label="Link a la propuesta">
        <input
          name="proposal_url"
          type="url"
          inputMode="url"
          defaultValue={defaults?.proposal_url ?? ""}
          placeholder="https://"
          title="Ingresá una URL que empiece con http:// o https://"
          className={fieldControlClass}
        />
      </Field>
      <Field label="Carpeta general">
        <input
          name="drive_folder_url"
          type="url"
          inputMode="url"
          defaultValue={defaults?.drive_folder_url ?? ""}
          placeholder="https://"
          title="Ingresá una URL que empiece con http:// o https://"
          className={fieldControlClass}
        />
      </Field>
      <Field label="Duración prevista">
        <input
          name="planned_duration"
          defaultValue={defaults?.planned_duration ?? ""}
          className={fieldControlClass}
        />
      </Field>
      <Field label="Fecha de comienzo (kickoff)">
        <input
          name="kickoff_on"
          type="date"
          defaultValue={defaults?.kickoff_on ?? ""}
          className={fieldControlClass}
        />
      </Field>
      <Field label="Fecha de finalización (contrato)">
        <input
          name="end_on"
          type="date"
          value={endOn}
          onChange={(e) => {
            const value = e.target.value;
            setEndOn(value);
            if (!actualTouched) setActualEndOn(value);
          }}
          className={fieldControlClass}
        />
      </Field>
      <Field label="Fecha de finalización real">
        <input
          name="actual_end_on"
          type="date"
          value={actualEndOn}
          onChange={(e) => {
            setActualTouched(true);
            setActualEndOn(e.target.value);
          }}
          className={fieldControlClass}
        />
      </Field>
      <Field label="Agenda de pagos">
        <textarea
          name="payment_schedule"
          rows={4}
          defaultValue={defaults?.payment_schedule ?? ""}
          className={fieldControlClass}
        />
      </Field>
      <Field label="Punto de cobro">
        <select name="billing_point" defaultValue={defaults?.billing_point ?? ""} className={fieldControlClass}>
          <option value="">Sin definir</option>
          <option value="spuy">SPUY</option>
          <option value="spar">SPAR</option>
        </select>
      </Field>
    </>
  );
}

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

function UrlOrDash({ href }: { href: string | null | undefined }) {
  const value = href?.trim();
  if (!value) return "—";
  return (
    <a href={value} className="break-all text-cyan hover:underline" target="_blank" rel="noreferrer">
      {value}
    </a>
  );
}

export function ProjectContractReadout({ values }: { values: ProjectContractValues }) {
  const rows: { label: string; value: ReactNode }[] = [
    { label: "Partner", value: dash(values.partner) },
    { label: "Fecha de firma", value: formatDay(values.contract_signed_on) },
    { label: "Propuesta", value: <UrlOrDash href={values.proposal_url} /> },
    { label: "Carpeta general", value: <UrlOrDash href={values.drive_folder_url} /> },
    { label: "Duración prevista", value: dash(values.planned_duration) },
    { label: "Kickoff", value: formatDay(values.kickoff_on) },
    { label: "Finalización (contrato)", value: formatDay(values.end_on) },
    { label: "Finalización real", value: formatDay(values.actual_end_on) },
    { label: "Agenda de pagos", value: dash(values.payment_schedule) },
    { label: "Punto de cobro", value: billingLabel(values.billing_point) },
  ];

  return (
    <dl className="space-y-3 text-sm">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="font-medium text-navy">{row.label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
