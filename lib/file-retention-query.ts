import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDaysIso,
  isFileRetentionPending,
  todayInBuenosAires,
  type FileRetentionProject,
} from "@/lib/file-retention";

type ClientRel = { name: string } | { name: string }[] | null;

function clientNameFrom(rel: ClientRel) {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0]?.name ?? null) : rel.name;
}

/** Proyectos con retención vencida y sin resolver (según fin real). */
export async function fetchPendingFileRetentionProjects(
  supabase: SupabaseClient,
  opts?: { projectIds?: string[] },
): Promise<FileRetentionProject[]> {
  const today = todayInBuenosAires();
  const actualEndMax = addDaysIso(today, -90);

  let query = supabase
    .from("projects")
    .select("id, code, actual_end_on, drive_folder_url, clients(name)")
    .not("actual_end_on", "is", null)
    .lte("actual_end_on", actualEndMax)
    .is("file_retention_resolution", null)
    .order("actual_end_on", { ascending: true });

  if (opts?.projectIds) {
    if (opts.projectIds.length === 0) return [];
    query = query.in("id", opts.projectIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => isFileRetentionPending(row.actual_end_on, null, today))
    .map((row) => ({
      id: row.id,
      code: row.code,
      actual_end_on: row.actual_end_on as string,
      drive_folder_url: row.drive_folder_url,
      clientName: clientNameFrom(row.clients as ClientRel),
    }));
}
