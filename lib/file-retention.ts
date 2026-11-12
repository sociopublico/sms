import { mondayOf, toISODate } from "@/lib/dates";

/** Días después de projects.actual_end_on para avisar retención de archivos. */
export const FILE_RETENTION_DAYS = 90;

export const FILE_RETENTION_POLICY_URL =
  "https://docs.google.com/spreadsheets/d/1B8KuDkQ8-KBaoXDSSsTjBBvNSSi5076WiUhcoiMOoWY/edit?usp=sharing";

/** Coincide con supabase/migrations/20260928134652_project_file_retention.sql */
export const FILE_RETENTION_TASK_ID = "a8c4e2f0-91b6-5d3a-9e17-6f0d4b8c2a15";
export const FILE_RETENTION_TASK_NAME = "Retención de archivos";

export type FileRetentionResolution = "done" | "not_applicable";

export type FileRetentionProject = {
  id: string;
  code: string;
  actual_end_on: string;
  drive_folder_url: string | null;
  clientName?: string | null;
};

export function todayInBuenosAires() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

export function addDaysIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function formatDay(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

/** Fecha en que vence el plazo de retención (actual_end_on + 90). */
export function fileRetentionDueOn(actualEndOn: string) {
  return addDaysIso(actualEndOn, FILE_RETENTION_DAYS);
}

/** Lunes de la semana que contiene el vencimiento (celda del timeline). */
export function fileRetentionWeekStart(actualEndOn: string) {
  const due = fileRetentionDueOn(actualEndOn);
  const [year, month, day] = due.split("-").map(Number);
  return toISODate(mondayOf(new Date(Date.UTC(year, month - 1, day))));
}

export function isFileRetentionPending(
  actualEndOn: string | null | undefined,
  resolution: FileRetentionResolution | null | undefined,
  today = todayInBuenosAires(),
) {
  if (!actualEndOn || resolution) return false;
  return fileRetentionDueOn(actualEndOn) <= today;
}
