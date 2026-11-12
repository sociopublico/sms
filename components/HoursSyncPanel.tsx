"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  disconnectDrive,
  importHoursSheet,
  registerDriveHoursFiles,
} from "@/app/(app)/drive-actions";
import { loadDriveHoursFile, markDriveHoursFileSkipped } from "@/app/(app)/hours-actions";
import { ConnectDriveButton } from "@/components/ConnectDriveButton";
import { Button } from "@/components/ui/Button";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageNotice } from "@/components/ui/PageNotice";
import { DRIVE_ROOT_FOLDER_ID } from "@/lib/drive-constants";

type SyncFile = {
  id: string;
  fileName: string;
  folderName: string;
  personId: string | null;
  personName: string | null;
  inferredMonth: string | null;
  monthLabel: string | null;
  status: string;
  syncedAt: string | null;
  errorMessage: string | null;
};

type SyncGroup = {
  personName: string;
  loaded: number;
  pending: number;
  incompatible: number;
  files: SyncFile[];
};

export function HoursSyncPanel({
  isAdmin,
  driveConnected,
  connectedEmail,
  connectedAt,
  rootFolderId,
  banner,
  groups,
}: {
  isAdmin: boolean;
  driveConnected: boolean;
  connectedEmail: string | null;
  connectedAt: string | null;
  rootFolderId: string | null;
  banner?: { kind: "ok" | "error"; text: string } | null;
  groups: SyncGroup[];
}) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(!driveConnected);
  const [openPeople, setOpenPeople] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function togglePerson(name: string) {
    setOpenPeople((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function finishWithNotice(text: string, kind: "ok" | "error" = "ok") {
    const params = new URLSearchParams();
    params.set("notice", text);
    params.set("noticeKind", kind);
    router.replace(`/horas/sync?${params.toString()}`);
    router.refresh();
  }

  function run(action: () => Promise<string | void>) {
    setError(null);
    startTransition(async () => {
      try {
        const message = await action();
        finishWithNotice(message || "Listo.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div className="space-y-6">
      {banner ? <PageNotice kind={banner.kind} text={banner.text} clearHref="/horas/sync" /> : null}

      <div className="flex justify-end">
        <button
          type="button"
          aria-expanded={settingsOpen}
          aria-label="Configuración de sync"
          onClick={() => setSettingsOpen((open) => !open)}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-navy transition-colors hover:bg-canvas hover:text-cyan ${
            settingsOpen ? "bg-canvas text-cyan" : ""
          }`}
        >
          <GearIcon />
        </button>
      </div>

      {settingsOpen ? (
        <div className="space-y-5 rounded-xl border border-line bg-paper p-5">
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-ink">Google Drive</h2>
            {isAdmin ? <ConnectDriveButton /> : null}
            {driveConnected ? (
              <div className="space-y-1 text-sm text-muted">
                <p>
                  Conectado
                  {connectedEmail ? (
                    <>
                      {" "}
                      por <span className="font-medium text-ink">{connectedEmail}</span>
                    </>
                  ) : null}
                  {connectedAt ? (
                    <>
                      {" "}
                      · {new Date(connectedAt).toLocaleString("es-AR", { hour12: false })}
                    </>
                  ) : null}
                </p>
                <p className="break-all">
                  Carpeta: {rootFolderId || DRIVE_ROOT_FOLDER_ID}
                </p>
                {isAdmin ? (
                  <ConfirmDelete
                    label="la conexión de Drive"
                    title="¿Desconectar Google Drive?"
                    description="Se corta el sync de CSVs para todo el equipo hasta que un admin vuelva a conectar."
                    confirmLabel="Desconectar"
                    triggerLabel="Desconectar"
                    triggerClassName="inline-flex items-center justify-center rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-navy hover:bg-canvas hover:text-navy disabled:cursor-not-allowed disabled:opacity-50"
                    action={async () => {
                      await disconnectDrive();
                      finishWithNotice("Drive desconectado.");
                    }}
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-danger">
                {isAdmin
                  ? "Todavía no hay una conexión de Drive guardada."
                  : "Drive todavía no está conectado. Pedile a un admin que lo conecte."}
              </p>
            )}
          </section>

          <section className="space-y-2 border-t border-line pt-4">
            <Button
              type="button"
              variant="primary"
              disabled={pending || !driveConnected}
              onClick={() =>
                run(async () => {
                  const result = await registerDriveHoursFiles();
                  return `Estado actualizado: ${result.upserted} archivos · ${result.syncedHistorical} históricos · ${result.pending} pendientes.`;
                })
              }
            >
              Actualizar estado CSVs
            </Button>
            <p className="text-sm text-muted">
              Relee las carpetas de Drive y actualiza qué CSV hay por persona (pending / ya
              cubiertos por el histórico).
            </p>
          </section>

          <section className="space-y-2 border-t border-line pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await importHoursSheet();
                  return (
                    `Tabla pisada: ${result.budgetsUpserted} PROY · ${result.entriesUpserted} entries` +
                    (result.skippedPersonRows ? ` · salteadas ${result.skippedPersonRows}` : "")
                  );
                })
              }
            >
              Pisar tabla de horas
            </Button>
            <p className="text-sm text-muted">
              Vuelve a importar el sheet histórico (PROY + horas mensuales) y reemplaza esos datos
              en la base.
            </p>
          </section>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!driveConnected ? (
        <p className="text-sm text-muted">
          Abrí la configuración (engranaje) y conectá Google Drive para actualizar CSVs.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          title="Todavía no hay CSVs indexados"
          description='Abrí el engranaje y usá “Actualizar estado CSVs”.'
        />
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => {
            const open = Boolean(openPeople[group.personName]);
            return (
              <li key={group.personName} className="rounded-xl border border-line bg-paper">
                <button
                  type="button"
                  onClick={() => togglePerson(group.personName)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
                  aria-expanded={open}
                >
                  <span className="text-muted" aria-hidden>
                    {open ? "▾" : "▸"}
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-ink">{group.personName}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <CountPill
                      label="cargados"
                      count={group.loaded}
                      className="bg-green/15 text-ink"
                    />
                    <CountPill
                      label="pendientes"
                      count={group.pending}
                      className="bg-cyan/10 text-cyan"
                    />
                    <CountPill
                      label="no compatibles"
                      count={group.incompatible}
                      className="bg-danger/10 text-ink"
                    />
                  </span>
                </button>

                {open ? (
                  <ul className="space-y-2 border-t border-line px-4 py-3">
                    {group.files.map((file) => (
                      <li
                        key={file.id}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <StatusBadge status={file.status} />
                        <span className="min-w-0 flex-1 text-navy">
                          <span className="font-medium text-ink">
                            {file.monthLabel ?? "sin mes"}
                          </span>
                          <span className="text-muted"> · {file.fileName}</span>
                          {file.errorMessage ? (
                            <span className="block text-danger">{file.errorMessage}</span>
                          ) : null}
                        </span>
                        {file.status === "pending" || file.status === "error" ? (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="primary"
                              className="!px-3 !py-1.5 !text-xs"
                              disabled={pending || !file.personId}
                              onClick={() =>
                                run(async () => {
                                  await loadDriveHoursFile(file.id);
                                  return `Cargado: ${file.fileName}`;
                                })
                              }
                            >
                              Cargar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="!px-3 !py-1.5 !text-xs"
                              disabled={pending}
                              onClick={() =>
                                run(async () => {
                                  await markDriveHoursFileSkipped(file.id);
                                  return `Omitido: ${file.fileName}`;
                                })
                              }
                            >
                              Skip
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CountPill({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${className}`}
    >
      {count} {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "pendiente",
    synced: "cargado",
    skipped: "skip",
    error: "no compatible",
  };
  const tone =
    status === "synced"
      ? "bg-green/15 text-ink"
      : status === "pending"
        ? "bg-cyan/10 text-cyan"
        : status === "error"
          ? "bg-danger/15 text-ink"
          : "bg-canvas text-muted";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {labels[status] ?? status}
    </span>
  );
}

function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
