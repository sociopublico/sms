"use client";

import { useMemo, useState } from "react";
import { ClientSelect } from "@/components/ClientSelect";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { buildProjectCode } from "@/lib/project-code";

const NEW_CLIENT = "__new__";

function suggestedCode(
  kind: string,
  projectName: string,
  clientName: string | null,
) {
  if (kind !== "client" && kind !== "internal") return "";
  return buildProjectCode(kind, projectName, clientName);
}

export function ProjectFields({
  clients,
  defaultKind = "",
  defaultClientId = "",
  defaultName = "",
  defaultCode = "",
  defaultFichaUrl = "",
  codeRequired = false,
  requireKindChoice = false,
}: {
  clients: { id: string; name: string }[];
  defaultKind?: string;
  defaultClientId?: string;
  defaultName?: string;
  defaultCode?: string;
  defaultFichaUrl?: string;
  codeRequired?: boolean;
  requireKindChoice?: boolean;
}) {
  const clientOptions = clients.filter((client) => client.name !== "Interno");
  const initialClientName =
    defaultKind === "client"
      ? (clientOptions.find((client) => client.id === defaultClientId)?.name ?? null)
      : null;
  const initialSuggested = suggestedCode(defaultKind, defaultName, initialClientName);

  const [kind, setKind] = useState(defaultKind);
  const [projectName, setProjectName] = useState(defaultName);
  const [clientId, setClientId] = useState(defaultClientId);
  const [newClientName, setNewClientName] = useState("");
  const [code, setCode] = useState(defaultCode || initialSuggested);
  const [codeTouched, setCodeTouched] = useState(
    Boolean(defaultCode && defaultCode !== initialSuggested),
  );

  const isClient = kind === "client";

  const selectedClientName = useMemo(() => {
    if (kind === "internal") return null;
    if (clientId === NEW_CLIENT) return newClientName.trim() || null;
    return clientOptions.find((client) => client.id === clientId)?.name ?? null;
  }, [kind, clientId, newClientName, clientOptions]);

  function applySuggestion(nextKind: string, nextName: string, nextClientName: string | null) {
    if (codeTouched) return;
    setCode(suggestedCode(nextKind, nextName, nextClientName));
  }

  return (
    <>
      <Field label="Nombre del proyecto">
        <input
          name="name"
          required
          value={projectName}
          onChange={(event) => {
            const next = event.target.value;
            setProjectName(next);
            applySuggestion(kind, next, selectedClientName);
          }}
          className={fieldControlClass}
        />
      </Field>
      <Field label="Tipo">
        <select
          name="kind"
          required
          value={kind}
          onChange={(event) => {
            const next = event.target.value;
            setKind(next);
            if (next !== "client") {
              setClientId("");
              setNewClientName("");
              applySuggestion(next, projectName, null);
            } else {
              const clientName =
                clientId === NEW_CLIENT
                  ? newClientName.trim() || null
                  : (clientOptions.find((client) => client.id === clientId)?.name ?? null);
              applySuggestion(next, projectName, clientName);
            }
          }}
          className={fieldControlClass}
        >
          {requireKindChoice ? <option value="">Elegir tipo</option> : null}
          <option value="client">Cliente</option>
          <option value="internal">Interno</option>
        </select>
      </Field>
      {isClient ? (
        <Field label="Cliente">
          <ClientSelect
            clients={clientOptions}
            value={clientId}
            onChange={(nextId) => {
              setClientId(nextId);
              const clientName =
                nextId === NEW_CLIENT
                  ? newClientName.trim() || null
                  : (clientOptions.find((client) => client.id === nextId)?.name ?? null);
              applySuggestion(kind, projectName, clientName);
            }}
            newClientName={newClientName}
            onNewClientNameChange={(nextName) => {
              setNewClientName(nextName);
              if (clientId === NEW_CLIENT) {
                applySuggestion(kind, projectName, nextName.trim() || null);
              }
            }}
          />
        </Field>
      ) : null}
      <Field label="ID de contrato">
        <input
          name="code"
          required={codeRequired || Boolean(projectName.trim())}
          value={code}
          onChange={(event) => {
            setCodeTouched(true);
            setCode(event.target.value);
          }}
          placeholder=""
          title="Se sugiere a partir del nombre y el cliente; podés editarlo"
          className={fieldControlClass}
        />
      </Field>
      <Field label="URL de ficha">
        <input
          name="ficha_url"
          defaultValue={defaultFichaUrl}
          className={fieldControlClass}
        />
      </Field>
    </>
  );
}
