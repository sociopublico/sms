import {
  FILE_RETENTION_TASK_ID,
  fileRetentionWeekStart,
  type FileRetentionResolution,
} from "@/lib/file-retention";

type DbClient = {
  from: (table: string) => any;
};

/** Quita la tarea de retención de todos los workstreams del proyecto. */
export async function clearRetentionTimelineMarkers(supabase: DbClient, projectId: string) {
  const { data: workstreams } = await supabase
    .from("workstreams")
    .select("id")
    .eq("project_id", projectId);

  const wsIds = (workstreams ?? []).map((w: { id: string }) => w.id);
  if (wsIds.length === 0) return;

  const { data: weeks } = await supabase
    .from("timeline_weeks")
    .select("id")
    .in("workstream_id", wsIds);

  const weekIds = (weeks ?? []).map((w: { id: string }) => w.id);
  if (weekIds.length === 0) return;

  await supabase
    .from("timeline_week_tasks")
    .delete()
    .in("timeline_week_id", weekIds)
    .eq("task_id", FILE_RETENTION_TASK_ID);
}

/**
 * Coloca (o mueve) la tarea "Retención de archivos" en el lunes de actual_end_on+90
 * del primer workstream del proyecto. Si no hay fin real o ya está resuelto, limpia.
 */
export async function syncFileRetentionTimelineMarker(
  supabase: DbClient,
  projectId: string,
  actualEndOn: string | null,
  resolution: FileRetentionResolution | null,
) {
  await clearRetentionTimelineMarkers(supabase, projectId);

  if (!actualEndOn || resolution) return;

  const { data: workstream } = await supabase
    .from("workstreams")
    .select("id")
    .eq("project_id", projectId)
    .order("name")
    .limit(1)
    .maybeSingle();

  if (!workstream) return;

  const weekStart = fileRetentionWeekStart(actualEndOn);

  const { data: existing } = await supabase
    .from("timeline_weeks")
    .select("id")
    .eq("workstream_id", workstream.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  let weekId = existing?.id as string | undefined;
  if (!weekId) {
    const { data, error } = await supabase
      .from("timeline_weeks")
      .insert({ workstream_id: workstream.id, week_start: weekStart })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    weekId = data.id;
  }

  const { error } = await supabase.from("timeline_week_tasks").upsert(
    { timeline_week_id: weekId, task_id: FILE_RETENTION_TASK_ID },
    { onConflict: "timeline_week_id,task_id" },
  );
  if (error) throw new Error(error.message);
}
