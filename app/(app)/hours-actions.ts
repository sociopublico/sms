"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSession, requireWriter } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import {
  downloadDriveFileText,
  refreshGoogleAccessToken,
} from "@/lib/drive";
import { DRIVE_ROOT_FOLDER_ID } from "@/lib/drive-constants";
import { normalizeAlias } from "@/lib/hours-sheet";
import { createClient } from "@/lib/supabase/server";
import { parseTogglDetailedToMonthly, projectAliasKey } from "@/lib/toggl-import";

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

async function resolveProjectIdMap(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("project_aliases").select("alias_normalized, project_id");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.project_id) map.set(row.alias_normalized, row.project_id);
  }
  return map;
}

function lookupProjectId(
  map: Map<string, string>,
  rawClient: string,
  rawProject: string,
): string | null {
  return (
    map.get(projectAliasKey(rawClient, rawProject)) ??
    map.get(normalizeAlias(rawProject)) ??
    null
  );
}

export type LoadDriveFileResult = {
  fileName: string;
  entriesUpserted: number;
  skippedRows: number;
  warning?: string;
};

export async function loadDriveHoursFile(fileRowId: string): Promise<LoadDriveFileResult> {
  return withAudit(
    "hours.load_drive_file",
    async () => {
      const { accessToken, supabase } = await getUsableAccessToken();
      const { data: fileRow, error } = await supabase
        .from("drive_hours_files")
        .select("id, drive_file_id, file_name, mime_type, person_id, inferred_month, status")
        .eq("id", fileRowId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!fileRow) throw new Error("Archivo no encontrado.");
      if (!fileRow.person_id) throw new Error("El archivo no tiene persona asignada.");

      try {
        const text = await downloadDriveFileText(accessToken, {
          id: fileRow.drive_file_id,
          name: fileRow.file_name,
          mimeType: fileRow.mime_type ?? "text/csv",
        });
        const parsed = parseTogglDetailedToMonthly(text, fileRow.inferred_month);
        if (parsed.warning && parsed.aggregates.length === 0) {
          await supabase
            .from("drive_hours_files")
            .update({
              status: "error",
              error_message: parsed.warning,
              synced_at: null,
            })
            .eq("id", fileRow.id);
          throw new Error(parsed.warning);
        }

        const projectMap = await resolveProjectIdMap(supabase);
        const rows = parsed.aggregates.map((agg) => ({
          person_id: fileRow.person_id!,
          raw_client_label: agg.rawClientLabel,
          raw_project_label: agg.rawProjectLabel,
          project_id: lookupProjectId(projectMap, agg.rawClientLabel, agg.rawProjectLabel),
          month_start: agg.monthStart,
          hours: agg.hours,
          source: "drive_csv" as const,
          source_ref: fileRow.drive_file_id,
        }));

        if (rows.length) {
          const { error: upsertError } = await supabase.from("time_entries").upsert(rows, {
            onConflict: "person_id,raw_client_label,raw_project_label,month_start,source",
          });
          if (upsertError) throw new Error(upsertError.message);
        }

        await supabase
          .from("drive_hours_files")
          .update({
            status: "synced",
            synced_at: new Date().toISOString(),
            error_message: parsed.warning ?? null,
          })
          .eq("id", fileRow.id);

        revalidatePath("/horas");
        revalidatePath("/horas/sync");
        return {
          fileName: fileRow.file_name,
          entriesUpserted: rows.length,
          skippedRows: parsed.skippedRows,
          warning: parsed.warning,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al cargar";
        await supabase
          .from("drive_hours_files")
          .update({ status: "error", error_message: message, synced_at: null })
          .eq("id", fileRow.id);
        throw err;
      }
    },
    { fileRowId },
    { type: "drive_hours_file", id: fileRowId },
  );
}

export async function markDriveHoursFileSkipped(fileRowId: string) {
  return withAudit(
    "hours.skip_drive_file",
    async () => {
      await requireWriter();
      const supabase = await createClient();
      const { error } = await supabase
        .from("drive_hours_files")
        .update({
          status: "skipped",
          synced_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", fileRowId);
      if (error) throw new Error(error.message);
      revalidatePath("/horas/sync");
    },
    { fileRowId },
    { type: "drive_hours_file", id: fileRowId },
  );
}

export async function linkProjectAlias(formData: FormData) {
  return withAudit(
    "hours.link_project_alias",
    async () => {
      const session = await requireSession();
      if (!session.canWrite) throw new Error("No tenés permiso para editar.");
      const supabase = await createClient();

      const projectId = String(formData.get("project_id") ?? "");
      const rawClientLabel = String(formData.get("raw_client_label") ?? "").trim();
      const rawProjectLabel = String(formData.get("raw_project_label") ?? "").trim();
      const aliasText = String(formData.get("alias") ?? "").trim() || rawProjectLabel;
      if (!projectId) throw new Error("Falta el proyecto.");
      if (!aliasText) throw new Error("Falta el alias.");

      const aliasNormalized = normalizeAlias(aliasText);
      const clientHint = rawClientLabel || null;

      const { error: aliasError } = await supabase.from("project_aliases").upsert(
        {
          alias: aliasText,
          alias_normalized: aliasNormalized,
          client_hint: clientHint,
          project_id: projectId,
        },
        { onConflict: "alias_normalized" },
      );
      if (aliasError) throw new Error(aliasError.message);

      // También alias compuesto cliente+proyecto si hay cliente
      if (rawClientLabel && rawProjectLabel) {
        const compound = projectAliasKey(rawClientLabel, rawProjectLabel);
        await supabase.from("project_aliases").upsert(
          {
            alias: `${rawClientLabel} · ${rawProjectLabel}`,
            alias_normalized: compound,
            client_hint: rawClientLabel,
            project_id: projectId,
          },
          { onConflict: "alias_normalized" },
        );
      }

      if (rawProjectLabel) {
        await supabase
          .from("time_entries")
          .update({ project_id: projectId })
          .eq("raw_project_label", rawProjectLabel)
          .is("project_id", null);
        if (rawClientLabel) {
          await supabase
            .from("time_entries")
            .update({ project_id: projectId })
            .eq("raw_project_label", rawProjectLabel)
            .eq("raw_client_label", rawClientLabel);
        }
        await supabase
          .from("person_project_budgets")
          .update({ project_id: projectId })
          .eq("raw_project_label", rawProjectLabel)
          .is("project_id", null);
        if (rawClientLabel) {
          await supabase
            .from("person_project_budgets")
            .update({ project_id: projectId })
            .eq("raw_project_label", rawProjectLabel)
            .eq("raw_client_label", rawClientLabel);
        }
      }

      revalidatePath(`/proyectos/${projectId}`);
      revalidatePath("/horas");
    },
    formDataToPayload(formData),
    { type: "project", id: String(formData.get("project_id") ?? "") },
  );
}

export async function unlinkProjectAlias(formData: FormData) {
  return withAudit(
    "hours.unlink_project_alias",
    async () => {
      const session = await requireSession();
      if (!session.canWrite) throw new Error("No tenés permiso para editar.");
      const supabase = await createClient();
      const aliasId = String(formData.get("alias_id") ?? "");
      const projectId = String(formData.get("project_id") ?? "");
      if (!aliasId) throw new Error("Falta el alias.");
      const { error } = await supabase.from("project_aliases").delete().eq("id", aliasId);
      if (error) throw new Error(error.message);
      revalidatePath(`/proyectos/${projectId}`);
      revalidatePath("/horas");
    },
    formDataToPayload(formData),
    { type: "project_alias", id: String(formData.get("alias_id") ?? "") },
  );
}

function formDataToPayload(formData: FormData) {
  const out: Record<string, string> = {};
  for (const key of formData.keys()) out[key] = String(formData.get(key) ?? "");
  return out;
}

export async function updatePersonProjectBudget(input: {
  personId: string;
  rawClientLabel: string;
  rawProjectLabel: string;
  projectId: string | null;
  estimatedHours: number;
}) {
  return withAudit(
    "hours.update_budget",
    async () => {
      const session = await requireSession();
      if (!session.canWrite) throw new Error("No tenés permiso para editar.");
      if (input.estimatedHours < 0) throw new Error("PROY no puede ser negativo.");
      const supabase = await createClient();
      const { error } = await supabase.from("person_project_budgets").upsert(
        {
          person_id: input.personId,
          raw_client_label: input.rawClientLabel,
          raw_project_label: input.rawProjectLabel,
          project_id: input.projectId,
          estimated_hours: Math.round(input.estimatedHours * 100) / 100,
        },
        { onConflict: "person_id,raw_client_label,raw_project_label" },
      );
      if (error) throw new Error(error.message);
      revalidatePath("/horas");
    },
    {
      personId: input.personId,
      project: input.rawProjectLabel,
      hours: input.estimatedHours,
    },
    { type: "person_project_budget", id: input.personId },
  );
}

export async function updatePersonMonthHours(input: {
  personId: string;
  rawClientLabel: string;
  rawProjectLabel: string;
  projectId: string | null;
  monthStart: string;
  hours: number;
}) {
  return withAudit(
    "hours.update_month",
    async () => {
      const session = await requireSession();
      if (!session.canWrite) throw new Error("No tenés permiso para editar.");
      if (input.hours < 0) throw new Error("Las horas no pueden ser negativas.");
      const supabase = await createClient();

      // Una sola fuente de verdad manual para ese mes/persona/proyecto.
      await supabase
        .from("time_entries")
        .delete()
        .eq("person_id", input.personId)
        .eq("raw_client_label", input.rawClientLabel)
        .eq("raw_project_label", input.rawProjectLabel)
        .eq("month_start", input.monthStart);

      if (input.hours > 0) {
        const { error } = await supabase.from("time_entries").insert({
          person_id: input.personId,
          raw_client_label: input.rawClientLabel,
          raw_project_label: input.rawProjectLabel,
          project_id: input.projectId,
          month_start: input.monthStart,
          hours: Math.round(input.hours * 100) / 100,
          source: "manual",
          source_ref: "ui",
        });
        if (error) throw new Error(error.message);
      }

      revalidatePath("/horas");
    },
    {
      personId: input.personId,
      project: input.rawProjectLabel,
      month: input.monthStart,
      hours: input.hours,
    },
    { type: "time_entry", id: input.personId },
  );
}
