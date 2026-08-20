"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireWriter } from "@/lib/auth";
import {
  DRIVE_OAUTH_SCOPES,
  DRIVE_ROOT_FOLDER_ID,
  FOLDER_MIME,
  SHEETS_MIME,
  downloadDriveFileText,
  formatSignature,
  isCsvLikeFile,
  isHoursCandidate,
  listDriveChildren,
  refreshGoogleAccessToken,
  sniffCsv,
} from "@/lib/drive";
import type { HoursFileReport, HoursInventoryReport, PersonFolderReport } from "@/lib/hours-inventory";
import {
  DRIVE_HISTORICAL_SYNC_THROUGH,
  fetchHoursSheetCsv,
  inferMonthFromFileName,
  parseHoursSheetCsv,
} from "@/lib/hours-sheet";
import { createClient } from "@/lib/supabase/server";
import { withAudit } from "@/lib/audit";

async function chunkedUpsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "person_project_budgets" | "time_entries" | "drive_hours_files",
  rows: Record<string, unknown>[],
  onConflict: string,
) {
  const size = 200;
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const { error } = await supabase.from(table).upsert(slice as never, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchPerson(folderName: string, peopleNames: string[]) {
  const folder = normalizeName(folderName);
  for (const name of peopleNames) {
    const person = normalizeName(name);
    if (folder === person || folder.startsWith(`${person} `) || folder.includes(` ${person}`)) {
      return name;
    }
  }
  for (const name of peopleNames) {
    const person = normalizeName(name);
    if (person.length >= 3 && folder.includes(person)) return name;
  }
  return null;
}

export async function saveDriveConnectionFromSession() {
  return withAudit(
    "drive.connect",
    async () => {
      const session = await requireAdmin();
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw new Error(error.message);
      const refreshToken = data.session?.provider_refresh_token;
      const accessToken = data.session?.provider_token ?? null;
      if (!refreshToken) {
        throw new Error(
          "Google no devolvió refresh token. Volvé a conectar Drive (hace falta consent + offline).",
        );
      }
      const expiresAt = accessToken ? new Date(Date.now() + 55 * 60 * 1000).toISOString() : null;
      const { error: upsertError } = await supabase.from("drive_connections").upsert(
        {
          provider: "google",
          connected_by: session.id,
          refresh_token: refreshToken,
          access_token: accessToken,
          access_token_expires_at: expiresAt,
          scopes: DRIVE_OAUTH_SCOPES,
          root_folder_id: DRIVE_ROOT_FOLDER_ID,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "provider" },
      );
      if (upsertError) throw new Error(upsertError.message);
      revalidatePath("/horas/sync");
      revalidatePath("/integraciones/drive");
    },
    {},
    { type: "drive", id: "google" },
  );
}

export async function disconnectDrive() {
  return withAudit(
    "drive.disconnect",
    async () => {
      await requireAdmin();
      const supabase = await createClient();
      const { error } = await supabase.from("drive_connections").delete().eq("provider", "google");
      if (error) throw new Error(error.message);
      revalidatePath("/horas/sync");
      revalidatePath("/integraciones/drive");
    },
    {},
    { type: "drive", id: "google" },
  );
}

async function getUsableAccessToken() {
  await requireWriter();
  const supabase = await createClient();
  const { data: connection, error } = await supabase
    .from("drive_connections")
    .select("id, refresh_token, access_token, access_token_expires_at, root_folder_id")
    .eq("provider", "google")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!connection) throw new Error("Drive no está conectado.");

  const stillValid =
    connection.access_token &&
    connection.access_token_expires_at &&
    new Date(connection.access_token_expires_at).getTime() > Date.now() + 60_000;

  if (stillValid && connection.access_token) {
    return {
      accessToken: connection.access_token,
      folderId: connection.root_folder_id || DRIVE_ROOT_FOLDER_ID,
      supabase,
    };
  }

  const refreshed = await refreshGoogleAccessToken(connection.refresh_token);
  const { error: updateError } = await supabase
    .from("drive_connections")
    .update({
      access_token: refreshed.accessToken,
      access_token_expires_at: refreshed.expiresAt.toISOString(),
    })
    .eq("id", connection.id);
  if (updateError) throw new Error(updateError.message);

  return {
    accessToken: refreshed.accessToken,
    folderId: connection.root_folder_id || DRIVE_ROOT_FOLDER_ID,
    supabase,
  };
}

export async function listDriveRoot() {
  const { accessToken, folderId } = await getUsableAccessToken();
  const files = await listDriveChildren(accessToken, folderId);
  return { folderId, files };
}

export async function inventoryHoursDrive(): Promise<HoursInventoryReport> {
  const { accessToken, folderId, supabase } = await getUsableAccessToken();
  const [{ data: people }, { data: aliases }, rootChildren] = await Promise.all([
    supabase.from("people").select("display_name").eq("hidden", false).order("display_name"),
    supabase.from("drive_person_aliases").select("folder_name, people(display_name)"),
    listDriveChildren(accessToken, folderId),
  ]);
  const peopleNames = (people ?? []).map((person) => person.display_name);
  const aliasByFolder = new Map<string, string>();
  for (const row of aliases ?? []) {
    const linked = row.people;
    const displayName = Array.isArray(linked)
      ? linked[0]?.display_name
      : linked && typeof linked === "object" && "display_name" in linked
        ? String((linked as { display_name: string }).display_name)
        : null;
    if (displayName) aliasByFolder.set(row.folder_name, displayName);
  }
  const folders = rootChildren.filter((file) => file.mimeType === FOLDER_MIME);
  const reports: PersonFolderReport[] = [];

  for (const folder of folders) {
    const children = await listDriveChildren(accessToken, folder.id);
    const candidates = children.filter(isHoursCandidate);
    const otherFiles = children
      .filter((file) => !isHoursCandidate(file))
      .map((file) => ({ id: file.id, name: file.name, mimeType: file.mimeType }));

    const files: HoursFileReport[] = [];
    for (const file of candidates) {
      try {
        const text = await downloadDriveFileText(accessToken, file);
        const sniffed = sniffCsv(text);
        files.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          kind: file.mimeType === SHEETS_MIME ? "sheet" : isCsvLikeFile(file) ? "csv" : "other",
          headers: sniffed.headers,
          signature: formatSignature(sniffed.headers),
          delimiter: sniffed.delimiter === "\t" ? "tab" : sniffed.delimiter,
          rowCountSample: sniffed.rowCountSample,
        });
      } catch (error) {
        files.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          kind: file.mimeType === SHEETS_MIME ? "sheet" : isCsvLikeFile(file) ? "csv" : "other",
          headers: [],
          signature: "",
          delimiter: ",",
          rowCountSample: 0,
          error: error instanceof Error ? error.message : "Error al leer archivo",
        });
      }
    }

    reports.push({
      folderId: folder.id,
      folderName: folder.name,
      matchedPersonName:
        aliasByFolder.get(folder.name) ?? matchPerson(folder.name, peopleNames),
      files,
      otherFiles,
    });
  }

  const matched = new Set(reports.map((report) => report.matchedPersonName).filter(Boolean));
  const signatureMap = new Map<string, { count: number; examples: string[] }>();
  for (const report of reports) {
    for (const file of report.files) {
      if (!file.signature) continue;
      const current = signatureMap.get(file.signature) ?? { count: 0, examples: [] };
      current.count += 1;
      if (current.examples.length < 3) current.examples.push(`${report.folderName}/${file.name}`);
      signatureMap.set(file.signature, current);
    }
  }

  return {
    rootFolderId: folderId,
    generatedAt: new Date().toISOString(),
    folders: reports.sort((a, b) => a.folderName.localeCompare(b.folderName, "es")),
    peopleWithoutFolder: peopleNames.filter((name) => !matched.has(name)),
    foldersWithoutCsv: reports
      .filter((report) => report.files.filter((file) => !file.error).length === 0)
      .map((report) => report.folderName),
    formatSignatures: [...signatureMap.entries()]
      .map(([signature, value]) => ({ signature, ...value }))
      .sort((a, b) => b.count - a.count),
  };
}

export type HoursSheetImportResult = {
  projectCount: number;
  budgetsUpserted: number;
  entriesUpserted: number;
  skippedPersonRows: number;
  skippedPersonNames: string[];
};

export async function importHoursSheet(): Promise<HoursSheetImportResult> {
  return withAudit(
    "hours.import_sheet",
    async () => {
      await requireWriter();
      const supabase = await createClient();
      const [{ data: people }, { data: aliases }] = await Promise.all([
        supabase.from("people").select("id, display_name").eq("hidden", false),
        supabase.from("person_name_aliases").select("alias, person_id"),
      ]);

      const byName = new Map<string, string>();
      for (const person of people ?? []) {
        byName.set(person.display_name, person.id);
        byName.set(person.display_name.toLowerCase(), person.id);
      }
      for (const row of aliases ?? []) {
        byName.set(row.alias, row.person_id);
        byName.set(row.alias.toLowerCase(), row.person_id);
      }

      const csvText = await fetchHoursSheetCsv();
      const parsed = parseHoursSheetCsv(csvText, (name) => {
        return byName.get(name) ?? byName.get(name.toLowerCase()) ?? null;
      });

      const [{ data: projectAliases }] = await Promise.all([
        supabase.from("project_aliases").select("alias_normalized, project_id"),
      ]);
      const projectByAlias = new Map<string, string>();
      for (const row of projectAliases ?? []) {
        if (row.project_id) projectByAlias.set(row.alias_normalized, row.project_id);
      }

      function resolveProjectId(rawClient: string, rawProject: string) {
        const key = `${rawClient} ${rawProject}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
        return (
          projectByAlias.get(key) ??
          projectByAlias.get(
            rawProject
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, " ")
              .trim(),
          ) ??
          null
        );
      }

      const budgetRows = parsed.budgets.map((budget) => ({
        person_id: budget.personId,
        raw_client_label: budget.rawClientLabel,
        raw_project_label: budget.rawProjectLabel,
        project_id: resolveProjectId(budget.rawClientLabel, budget.rawProjectLabel),
        estimated_hours: budget.estimatedHours,
      }));
      const entryRows = parsed.entries.map((entry) => ({
        person_id: entry.personId,
        raw_client_label: entry.rawClientLabel,
        raw_project_label: entry.rawProjectLabel,
        project_id: resolveProjectId(entry.rawClientLabel, entry.rawProjectLabel),
        month_start: entry.monthStart,
        hours: entry.hours,
        source: "hours_sheet" as const,
        source_ref: "hours_sheet_csv",
      }));

      await chunkedUpsert(supabase, "person_project_budgets", budgetRows, "person_id,raw_client_label,raw_project_label");
      await chunkedUpsert(
        supabase,
        "time_entries",
        entryRows,
        "person_id,raw_client_label,raw_project_label,month_start,source",
      );

      revalidatePath("/horas");
      revalidatePath("/horas/sync");

      return {
        projectCount: parsed.projectCount,
        budgetsUpserted: budgetRows.length,
        entriesUpserted: entryRows.length,
        skippedPersonRows: parsed.skippedPersonRows,
        skippedPersonNames: parsed.skippedPersonNames,
      };
    },
    {},
    { type: "hours", id: "sheet" },
  );
}

export type DriveHoursFilesRegisterResult = {
  filesSeen: number;
  upserted: number;
  syncedHistorical: number;
  pending: number;
  withoutPerson: number;
  withoutMonth: number;
};

export async function registerDriveHoursFiles(): Promise<DriveHoursFilesRegisterResult> {
  return withAudit(
    "hours.register_drive_files",
    async () => {
      const { accessToken, folderId, supabase } = await getUsableAccessToken();
      const [{ data: people }, { data: folderAliases }, rootChildren] = await Promise.all([
        supabase.from("people").select("id, display_name").eq("hidden", false),
        supabase.from("drive_person_aliases").select("folder_name, person_id"),
        listDriveChildren(accessToken, folderId),
      ]);

      const personByDisplay = new Map((people ?? []).map((p) => [p.display_name, p.id]));
      const personByFolder = new Map((folderAliases ?? []).map((a) => [a.folder_name, a.person_id]));
      const peopleNames = (people ?? []).map((p) => p.display_name);

      const folders = rootChildren.filter((file) => file.mimeType === FOLDER_MIME);
      const rows: {
        drive_file_id: string;
        person_id: string | null;
        folder_id: string;
        folder_name: string;
        file_name: string;
        mime_type: string;
        inferred_month: string | null;
        status: "pending" | "synced" | "skipped" | "error";
        synced_at: string | null;
        error_message: string | null;
      }[] = [];

      let syncedHistorical = 0;
      let pending = 0;
      let withoutPerson = 0;
      let withoutMonth = 0;

      // Preservar synced/skipped existentes; no bajar de categoría al re-registrar.
      const { data: existing } = await supabase
        .from("drive_hours_files")
        .select("drive_file_id, status, synced_at, error_message");
      const existingById = new Map(
        (existing ?? []).map((row) => [row.drive_file_id, row] as const),
      );

      for (const folder of folders) {
        const matchedName = matchPerson(folder.name, peopleNames);
        const personId =
          personByFolder.get(folder.name) ??
          (matchedName ? (personByDisplay.get(matchedName) ?? null) : null);

        const children = await listDriveChildren(accessToken, folder.id);
        for (const file of children.filter(isHoursCandidate)) {
          const inferredMonth = inferMonthFromFileName(file.name);
          const prev = existingById.get(file.id);
          let status: "pending" | "synced" | "skipped" | "error" = "pending";
          let syncedAt: string | null = null;
          let errorMessage: string | null = null;

          if (prev?.status === "synced" || prev?.status === "skipped") {
            status = prev.status;
            syncedAt = prev.synced_at;
            syncedHistorical += 1;
          } else if (inferredMonth && inferredMonth <= DRIVE_HISTORICAL_SYNC_THROUGH) {
            status = "synced";
            syncedAt = new Date().toISOString();
            syncedHistorical += 1;
          } else {
            pending += 1;
            if (!inferredMonth) withoutMonth += 1;
            if (prev?.status === "error") {
              status = "error";
              errorMessage = prev.error_message;
            }
          }
          if (!personId) withoutPerson += 1;

          rows.push({
            drive_file_id: file.id,
            person_id: personId,
            folder_id: folder.id,
            folder_name: folder.name,
            file_name: file.name,
            mime_type: file.mimeType,
            inferred_month: inferredMonth,
            status,
            synced_at: syncedAt,
            error_message: errorMessage,
          });
        }
      }

      await chunkedUpsert(supabase, "drive_hours_files", rows, "drive_file_id");

      revalidatePath("/horas/sync");

      return {
        filesSeen: rows.length,
        upserted: rows.length,
        syncedHistorical,
        pending,
        withoutPerson,
        withoutMonth,
      };
    },
    {},
    { type: "hours", id: "drive_files" },
  );
}
