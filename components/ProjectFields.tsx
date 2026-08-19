"use client";

import { useState } from "react";
import { ClientSelect } from "@/components/ClientSelect";
import { Field, fieldControlClass } from "@/components/ui/Field";

export function ProjectFields({
  clients,
  defaultKind = "",
  defaultClientId = "",
  defaultCode = "",
  defaultFichaUrl = "",
  codeRequired = false,
  requireKindChoice = false,
}: {
  clients: { id: string; name: string }[];
  defaultKind?: string;
  defaultClientId?: string;
  defaultCode?: string;
  defaultFichaUrl?: string;
  codeRequired?: boolean;
  requireKindChoice?: boolean;
}) {
  const [kind, setKind] = useState(defaultKind);
  const isClient = kind === "client";
  const clientOptions = clients.filter((client) => client.name !== "Interno");

  return (
    <>
      <Field label="Tipo">
        <select
          name="kind"
          required
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className={fieldControlClass}
        >
          {requireKindChoice ? <option value="">Elegir tipo</option> : null}
          <option value="client">Cliente</option>
          <option value="internal">Interno</option>
        </select>
      </Field>
      {isClient ? (
        <Field label="Cliente">
          <ClientSelect clients={clientOptions} defaultClientId={defaultClientId} />
        </Field>
      ) : null}
      <Field label="ID de contrato">
        <input
          name="code"
          required={codeRequired}
          defaultValue={defaultCode}
          placeholder={codeRequired ? undefined : "Opcional"}
          className={fieldControlClass}
        />
      </Field>
      <Field label="URL de ficha">
        <input
          name="ficha_url"
          type="url"
          inputMode="url"
          defaultValue={defaultFichaUrl}
          placeholder="https://"
          title="Ingresá una URL que empiece con http:// o https://"
          className={fieldControlClass}
        />
      </Field>
    </>
  );
}
