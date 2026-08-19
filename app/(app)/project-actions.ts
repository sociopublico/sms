"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addWeeks, mondayOf, toISODate } from "@/lib/dates";
import { formPayload, withAudit } from "@/lib/audit";
import { parseOptionalHttpUrl } from "@/lib/urls";

const INTERNAL_CLIENT_NAME = "Interno";

async function assertWrite() {
  const session = await requireSession();
  if (!session.canWrite) throw new Error("No tenés permiso para editar.");
  return createClient();
}

type DbClient = Awaited<ReturnType<typeof createClient>>;

async function findOrCreateClient(supabase: DbClient, name: string) {
  const { data: existing } = await supabase.from("clients").select("id").eq("name", name).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from("clients").insert({ name }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

function parseProjectKind(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "client" && kind !== "internal") throw new Error("El tipo de proyecto es obligatorio.");
  return kind;
}

function parseFichaUrl(formData: FormData) {
  return parseOptionalHttpUrl(String(formData.get("ficha_url") ?? ""), "La URL de ficha");
}

async function resolveClientId(supabase: DbClient, formData: FormData, kind: string) {
  if (kind === "internal") return findOrCreateClient(supabase, INTERNAL_CLIENT_NAME);
  const clientId = String(formData.get("client_id") ?? "");
  const newName = String(formData.get("new_client_name") ?? "").trim();
  if (clientId && clientId !== "__new__") return clientId;
  if (!newName) throw new Error("El cliente es obligatorio.");
  return findOrCreateClient(supabase, newName);
}

export async function createProjectAndWorkstream(formData: FormData) {
  return withAudit(
    "projects.create_workstream",
    async () => {
      const supabase = await assertWrite();
      const existingProjectId = String(formData.get("existing_project_id") ?? "");
      const code = String(formData.get("code") ?? "").trim();
      const wsName = String(formData.get("workstream_name") ?? "").trim();
      const status = String(formData.get("status") ?? "en_curso");
      if (!wsName) throw new Error("El workstream es obligatorio.");

      let projectId = existingProjectId;
      if (!projectId) {
        const kind = parseProjectKind(formData);
        const fichaUrl = parseFichaUrl(formData);
        const clientId = await resolveClientId(supabase, formData, kind);
        const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
        const clientName = client?.name ?? "cliente";
        const generatedCode =
          code || `SIN-FICHA-${clientName}-${wsName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const { data: project, error } = await supabase
          .from("projects")
          .insert({
            code: generatedCode,
            client_id: clientId,
            ficha_url: fichaUrl,
            kind,
            status,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        projectId = project.id;
      }

      const payload: Record<string, unknown> = {
        project_id: projectId,
        name: wsName,
        status,
      };
      if (status === "mantenimiento") {
        const start = mondayOf(new Date());
        payload.start_on = toISODate(start);
        payload.end_on = toISODate(addWeeks(start, 52));
      }

      const { data: ws, error: wsError } = await supabase
        .from("workstreams")
        .insert(payload)
        .select("id")
        .single();
      if (wsError) throw new Error(wsError.message);

      revalidatePath("/proyectos");
      revalidatePath("/timeline");
      redirect(`/workstreams/${ws.id}`);
    },
    formPayload(formData),
    { type: "project", id: String(formData.get("existing_project_id") ?? "") || undefined },
  );
}

export async function updateProject(formData: FormData) {
  return withAudit(
    "projects.update",
    async () => {
      const supabase = await assertWrite();
      const id = String(formData.get("id") ?? "");
      const kind = parseProjectKind(formData);
      const clientId = await resolveClientId(supabase, formData, kind);
      const { error } = await supabase
        .from("projects")
        .update({
          client_id: clientId,
          code: String(formData.get("code") ?? "").trim(),
          ficha_url: parseFichaUrl(formData),
          kind,
          status: String(formData.get("status") ?? "en_curso"),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      revalidatePath("/proyectos");
      revalidatePath(`/proyectos/${id}`);
      revalidatePath("/timeline");
    },
    formPayload(formData),
    { type: "project", id: String(formData.get("id") ?? "") },
  );
}

export async function updateProjectStatus(id: string, status: string) {
  return withAudit(
    "projects.update_status",
    async () => {
      const supabase = await assertWrite();
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      revalidatePath("/proyectos");
      revalidatePath(`/proyectos/${id}`);
    },
    { id, status },
    { type: "project", id },
  );
}

export async function updateWorkstreamStatus(id: string, status: string) {
  return withAudit(
    "workstreams.update_status",
    async () => {
      const supabase = await assertWrite();
      const { error } = await supabase.from("workstreams").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      revalidatePath("/proyectos");
      revalidatePath("/timeline");
      revalidatePath(`/workstreams/${id}`);
    },
    { id, status },
    { type: "workstream", id },
  );
}

export async function updateWorkstream(formData: FormData) {
  return withAudit(
    "workstreams.update",
    async () => {
      const supabase = await assertWrite();
      const id = String(formData.get("id") ?? "");
      const { error } = await supabase
        .from("workstreams")
        .update({
          name: String(formData.get("name") ?? "").trim(),
          status: String(formData.get("status") ?? "en_curso"),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      revalidatePath("/proyectos");
      revalidatePath("/timeline");
      revalidatePath(`/workstreams/${id}`);
    },
    formPayload(formData),
    { type: "workstream", id: String(formData.get("id") ?? "") },
  );
}

export async function addAssignment(formData: FormData) {
  return withAudit(
    "workstreams.add_assignment",
    async () => {
      const supabase = await assertWrite();
      const workstreamId = String(formData.get("workstream_id") ?? "");
      const { error } = await supabase.from("assignments").insert({
        workstream_id: workstreamId,
        person_id: String(formData.get("person_id") ?? ""),
        role_id: String(formData.get("role_id") ?? ""),
      });
      if (error) throw new Error(error.message);
      revalidatePath(`/workstreams/${workstreamId}`);
      revalidatePath("/carga");
      revalidatePath("/timeline");
    },
    formPayload(formData),
    { type: "workstream", id: String(formData.get("workstream_id") ?? "") },
  );
}

export async function removeAssignment(assignmentId: string, workstreamId: string) {
  return withAudit(
    "workstreams.remove_assignment",
    async () => {
      const supabase = await assertWrite();
      const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
      if (error) throw new Error(error.message);
      revalidatePath(`/workstreams/${workstreamId}`);
      revalidatePath("/carga");
    },
    { assignmentId, workstreamId },
    { type: "assignment", id: assignmentId },
  );
}

export async function setWeekTasks(workstreamId: string, weekStart: string, taskIds: string[]) {
  return withAudit(
    "timeline.set_week_tasks",
    async () => {
      const supabase = await assertWrite();
      const { data: existing } = await supabase
        .from("timeline_weeks")
        .select("id")
        .eq("workstream_id", workstreamId)
        .eq("week_start", weekStart)
        .maybeSingle();

      let weekId = existing?.id as string | undefined;
      if (!weekId) {
        const { data, error } = await supabase
          .from("timeline_weeks")
          .insert({ workstream_id: workstreamId, week_start: weekStart })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        weekId = data.id;
      }

      await supabase.from("timeline_week_tasks").delete().eq("timeline_week_id", weekId);
      if (taskIds.length) {
        const { error } = await supabase
          .from("timeline_week_tasks")
          .insert(taskIds.map((task_id) => ({ timeline_week_id: weekId, task_id })));
        if (error) throw new Error(error.message);
      }
    },
    { workstreamId, weekStart, taskIds },
    { type: "workstream", id: workstreamId },
  );
}
