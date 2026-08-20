"use client";

import { useState, useTransition } from "react";
import {
  disconnectDrive,
  importHoursSheet,
  inventoryHoursDrive,
  listDriveRoot,
  registerDriveHoursFiles,
  type DriveHoursFilesRegisterResult,
  type HoursSheetImportResult,
} from "@/app/(app)/drive-actions";
import { Button } from "@/components/ui/Button";
import type { DriveFile } from "@/lib/drive-constants";
import type { HoursInventoryReport } from "@/lib/hours-inventory";

export function DriveConnectionPanel({
  connected,
  connectedEmail,
  connectedAt,
}: {
  connected: boolean;
  connectedEmail: string | null;
  connectedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [inventory, setInventory] = useState<HoursInventoryReport | null>(null);
  const [sheetImport, setSheetImport] = useState<HoursSheetImportResult | null>(null);
  const [driveRegister, setDriveRegister] = useState<DriveHoursFilesRegisterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function testList() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await listDriveRoot();
        setFiles(result.files);
      } catch (err) {
        setFiles(null);
        setError(err instanceof Error ? err.message : "No se pudo listar Drive.");
      }
    });
  }

  function runInventory() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await inventoryHoursDrive();
        setInventory(result);
      } catch (err) {
        setInventory(null);
        setError(err instanceof Error ? err.message : "No se pudo inventariar.");
      }
    });
  }

  function runSheetImport() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await importHoursSheet();
        setSheetImport(result);
      } catch (err) {
        setSheetImport(null);
        setError(err instanceof Error ? err.message : "No se pudo importar el sheet.");
      }
    });
  }

  function runDriveRegister() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await registerDriveHoursFiles();
        setDriveRegister(result);
      } catch (err) {
        setDriveRegister(null);
        setError(err instanceof Error ? err.message : "No se pudieron registrar los CSV.");
      }
    });
  }

  function disconnect() {
    setError(null);
    setFiles(null);
    setInventory(null);
    setSheetImport(null);
    setDriveRegister(null);
    startTransition(async () => {
      try {
        await disconnectDrive();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  if (!connected) {
    return <p className="text-sm text-muted">Todavía no hay una conexión de Drive guardada.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy">
        Conectado
        {connectedEmail ? (
          <>
            {" "}
            por <span className="font-medium text-ink">{connectedEmail}</span>
          </>
        ) : null}
        {connectedAt ? (
          <span className="text-muted">
            {" "}
            · {new Date(connectedAt).toLocaleString("es-AR", { hour12: false })}
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={pending} onClick={runInventory}>
          Inventariar horas (CSV)
        </Button>
        <Button type="button" variant="primary" disabled={pending} onClick={runSheetImport}>
          Importar sheet de horas
        </Button>
        <Button type="button" variant="primary" disabled={pending} onClick={runDriveRegister}>
          Registrar CSV Drive
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={testList}>
          Listar raíz
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={disconnect}>
          Desconectar
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {sheetImport ? (
        <div className="space-y-1 rounded-xl border border-line bg-canvas p-4 text-sm">
          <p className="font-medium text-ink">Import sheet</p>
          <p className="text-muted">
            {sheetImport.projectCount} proyectos · {sheetImport.budgetsUpserted} presupuestos ·{" "}
            {sheetImport.entriesUpserted} entries mensuales
          </p>
          {sheetImport.skippedPersonRows ? (
            <p className="text-muted">
              Salteadas {sheetImport.skippedPersonRows} filas (
              {sheetImport.skippedPersonNames.join(", ")})
            </p>
          ) : null}
        </div>
      ) : null}
      {driveRegister ? (
        <div className="space-y-1 rounded-xl border border-line bg-canvas p-4 text-sm">
          <p className="font-medium text-ink">CSV Drive registrados</p>
          <p className="text-muted">
            {driveRegister.filesSeen} archivos · {driveRegister.syncedHistorical} synced (≤ jul 2026) ·{" "}
            {driveRegister.pending} pending
          </p>
          <p className="text-muted">
            Sin persona: {driveRegister.withoutPerson} · sin mes inferido: {driveRegister.withoutMonth}
          </p>
        </div>
      ) : null}
      {inventory ? <InventoryReport report={inventory} /> : null}
      {files ? (
        <ul className="space-y-1 rounded-xl border border-line bg-canvas p-4 text-sm">
          {files.length === 0 ? (
            <li className="text-muted">La carpeta está vacía o no es visible con esta cuenta.</li>
          ) : (
            files.map((file) => (
              <li key={file.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium text-ink">{file.name}</span>
                <span className="text-muted">
                  {file.mimeType === "application/vnd.google-apps.folder" ? "carpeta" : file.mimeType}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function InventoryReport({ report }: { report: HoursInventoryReport }) {
  const withCsv = report.folders.filter((folder) => folder.files.some((file) => !file.error));
  const withoutCsv = report.foldersWithoutCsv;

  return (
    <div className="space-y-4 rounded-xl border border-line bg-canvas p-4 text-sm">
      <div className="space-y-1">
        <p className="font-medium text-ink">Inventario</p>
        <p className="text-muted">
          {report.folders.length} carpetas · {withCsv.length} con CSV/Sheet · {withoutCsv.length} sin
          archivo de horas
        </p>
        <p className="text-muted">
          Generado {new Date(report.generatedAt).toLocaleString("es-AR", { hour12: false })}
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="font-medium text-ink">Formatos detectados</h3>
        {report.formatSignatures.length === 0 ? (
          <p className="text-muted">No se pudieron leer headers.</p>
        ) : (
          <ul className="space-y-2">
            {report.formatSignatures.map((format) => (
              <li key={format.signature} className="rounded-lg border border-line bg-paper p-3">
                <p className="font-medium text-navy">
                  {format.count} archivo{format.count === 1 ? "" : "s"}
                </p>
                <p className="mt-1 break-words text-muted">{format.signature}</p>
                <p className="mt-1 text-muted">ej: {format.examples.join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {withoutCsv.length ? (
        <section className="space-y-1">
          <h3 className="font-medium text-ink">Carpetas sin CSV/Sheet</h3>
          <p className="text-muted">{withoutCsv.join(", ")}</p>
        </section>
      ) : null}

      {report.peopleWithoutFolder.length ? (
        <section className="space-y-1">
          <h3 className="font-medium text-ink">Personas del catálogo sin carpeta matcheada</h3>
          <p className="text-muted">{report.peopleWithoutFolder.join(", ")}</p>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="font-medium text-ink">Por carpeta</h3>
        <ul className="space-y-2">
          {report.folders.map((folder) => (
            <li key={folder.folderId} className="rounded-lg border border-line bg-paper p-3">
              <p className="font-medium text-ink">
                {folder.folderName}
                {folder.matchedPersonName ? (
                  <span className="font-normal text-muted"> → {folder.matchedPersonName}</span>
                ) : (
                  <span className="font-normal text-danger"> → sin match</span>
                )}
              </p>
              {folder.files.length === 0 ? (
                <p className="mt-1 text-muted">Sin CSV/Sheet</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {folder.files.map((file) => (
                    <li key={file.id}>
                      <span className="text-navy">{file.name}</span>
                      <span className="text-muted"> · {file.kind}</span>
                      {file.error ? (
                        <span className="text-danger"> · {file.error}</span>
                      ) : (
                        <span className="text-muted">
                          {" "}
                          · {file.rowCountSample}+ filas · sep {file.delimiter}
                        </span>
                      )}
                      {file.headers.length ? (
                        <p className="text-muted">{file.headers.join(" | ")}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {folder.otherFiles.length ? (
                <p className="mt-1 text-muted">
                  Otros: {folder.otherFiles.map((file) => file.name).join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
