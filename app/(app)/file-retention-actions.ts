"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import type { FileRetentionResolution } from "@/lib/file-retention";
import { syncFileRetentionTimelineMarker } from "@/lib/file-retention-sync";
import { createClient } from "@/lib/supabase/server";

function canResolveRetention(appRole: string) {
  return appRole === "admin" || appRole === "pm";
}

export async function resolveFileRetention(
  projectId: string,
  resolution: FileRetentionResolution,
  _formData?: FormData,
) {
  return withAudit(
    "projects.file_retention_resolve",
    async () => {
      const session = await requireSession();
      if (!canResolveRetention(session.appRole)) {
        throw new Error("Solo la PM o un admin pueden cerrar este recordatorio.");
      }
      if (resolution !== "done" && resolution !== "not_applicable") {
        throw new Error("Resolución inválida.");
      }

      const supabase = await createClient();
      const { data: project, error: fetchError } = await supabase
        .from("projects")
        .select("id, end_on, actual_end_on, file_retention_resolution")
        .eq("id", projectId)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!project) throw new Error("Proyecto no encontrado.");
      if (project.file_retention_resolution) {
        throw new Error("Este recordatorio ya fue cerrado.");
      }

      const { error } = await supabase
        .from("projects")
        .update({
          file_retention_resolution: resolution,
          file_retention_resolved_at: new Date().toISOString(),
          file_retention_resolved_by: session.id,
        })
        .eq("id", projectId);
      if (error) throw new Error(error.message);

      await syncFileRetentionTimelineMarker(
        supabase,
        projectId,
        project.actual_end_on,
        resolution,
      );

      revalidatePath("/editor");
      revalidatePath("/staff");
      revalidatePath("/timeline");
      revalidatePath(`/proyectos/${projectId}`);
    },
    { projectId, resolution },
    { type: "project", id: projectId },
  );
}
