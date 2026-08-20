"use client";

import { useMemo, useState, useTransition } from "react";
import { linkProjectAlias, unlinkProjectAlias } from "@/app/(app)/hours-actions";
import { Button } from "@/components/ui/Button";
import { Field, fieldControlClass } from "@/components/ui/Field";

export type UnmatchedHoursLabel = {
  rawClientLabel: string;
  rawProjectLabel: string;
  entryCount: number;
};

export type ProjectAliasRow = {
  id: string;
  alias: string;
  clientHint: string | null;
};

function labelKey(item: UnmatchedHoursLabel) {
  return `${item.rawClientLabel}\t${item.rawProjectLabel}`;
}

function sortUnmatched(items: UnmatchedHoursLabel[]) {
  return [...items].sort((a, b) => {
    const client = a.rawClientLabel.localeCompare(b.rawClientLabel, "es", { sensitivity: "base" });
    if (client !== 0) return client;
    return a.rawProjectLabel.localeCompare(b.rawProjectLabel, "es", { sensitivity: "base" });
  });
}

export function ProjectHoursAliases({
  projectId,
  aliases,
  unmatched,
  canWrite,
}: {
  projectId: string;
  aliases: ProjectAliasRow[];
  unmatched: UnmatchedHoursLabel[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [pick, setPick] = useState("");
  const [alias, setAlias] = useState("");
  const [client, setClient] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => sortUnmatched(unmatched), [unmatched]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((item) => {
      const clientName = item.rawClientLabel.toLowerCase();
      const projectName = item.rawProjectLabel.toLowerCase();
      return clientName.includes(q) || projectName.includes(q);
    });
  }, [sorted, query]);

  function onPickChange(value: string) {
    setPick(value);
    if (!value) return;
    const [rawClient, rawProject] = value.split("\t");
    setClient(rawClient || "");
    setAlias(rawProject || "");
  }

  function submitLink(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("project_id", projectId);
    const [rawClient, rawProject] = pick ? pick.split("\t") : [client, alias];
    formData.set("raw_client_label", (rawClient || client).trim());
    formData.set("raw_project_label", (rawProject || alias).trim());
    formData.set("alias", alias.trim() || rawProject || "");
    startTransition(async () => {
      try {
        await linkProjectAlias(formData);
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo vincular");
      }
    });
  }

  function removeAlias(aliasId: string) {
    setError(null);
    const formData = new FormData();
    formData.set("alias_id", aliasId);
    formData.set("project_id", projectId);
    startTransition(async () => {
      try {
        await unlinkProjectAlias(formData);
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo quitar");
      }
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-ink">Aliases de horas</h2>
        <p className="mt-1 text-sm text-muted">
          Vinculá nombres del sheet/Toggl a este proyecto SMS para que la matriz sume acá.
        </p>
      </div>

      {aliases.length ? (
        <ul className="space-y-2">
          {aliases.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-ink">{row.alias}</p>
                {row.clientHint ? <p className="text-muted">Cliente sheet: {row.clientHint}</p> : null}
              </div>
              {canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="!px-3 !py-1.5 !text-xs"
                  disabled={pending}
                  onClick={() => removeAlias(row.id)}
                >
                  Quitar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Todavía no hay aliases vinculados.</p>
      )}

      {canWrite ? (
        <form onSubmit={submitLink} className="space-y-3 rounded-xl border border-line bg-paper p-4">
          {unmatched.length ? (
            <div className="space-y-2">
              <Field label="Buscar label">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={fieldControlClass}
                  placeholder="Cliente o proyecto…"
                />
              </Field>
              <Field label="Label sin vincular">
                <select
                  value={pick}
                  onChange={(e) => onPickChange(e.target.value)}
                  className={fieldControlClass}
                  size={Math.min(10, Math.max(4, filtered.length + 1))}
                >
                  <option value="">Elegir…</option>
                  {filtered.map((item) => (
                    <option key={labelKey(item)} value={labelKey(item)}>
                      {item.rawClientLabel ? `${item.rawClientLabel} · ` : ""}
                      {item.rawProjectLabel} ({item.entryCount})
                    </option>
                  ))}
                </select>
              </Field>
              {query && !filtered.length ? (
                <p className="text-sm text-muted">No hay labels que coincidan con “{query}”.</p>
              ) : (
                <p className="text-sm text-muted">
                  {filtered.length} de {sorted.length} labels · ordenados por cliente
                </p>
              )}
            </div>
          ) : null}
          <Field label="Alias / nombre en sheet">
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              className={fieldControlClass}
              placeholder="ej. Migration Unit"
              required
            />
          </Field>
          <Field label="Cliente sheet (opcional)">
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className={fieldControlClass}
              placeholder="ej. BID"
            />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="primary" disabled={pending}>
            Vincular alias
          </Button>
        </form>
      ) : null}
    </section>
  );
}
