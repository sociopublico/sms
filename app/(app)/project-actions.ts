"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addWeeks, mondayOf, toISODate } from "@/lib/dates";

async function assertWrite() {
  const session = await requireSession();
  if (!session.canWrite) throw new Error("No tenés permiso para editar.");
  return createClient();
}

export async function createProjectAndWorkstream(formData: FormData) {
  const supabase = await assertWrite();
  const existingProjectId = String(formData.get("existing_project_id") ?? "");
  const clientName = String(formData.get("client_name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const fichaUrl = String(formData.get("ficha_url") ?? "").trim() || null;
  const kind = (String(formData.get("kind") ?? "client") as "client" | "internal");
  const wsName = String(formData.get("workstream_name") ?? "").trim();
  const status = String(formData.get("status") ?? "en_curso");
  if (!wsName) throw new Error("El workstream es obligatorio.");

  let projectId = existingProjectId;
  if (!projectId) {
    if (!clientName) throw new Error("El cliente es obligatorio si no hay proyecto.");
    let clientId: string;
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("name", clientName)
      .maybeSingle();
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert({ name: clientName })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      clientId = data.id;
    }

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
}

export async function updateProject(formData: FormData) {
  const supabase = await assertWrite();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase
    .from("projects")
    .update({
      code: String(formData.get("code") ?? "").trim(),
      ficha_url: String(formData.get("ficha_url") ?? "").trim() || null,
      kind: String(formData.get("kind") ?? "client"),
      status: String(formData.get("status") ?? "en_curso"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${id}`);
}

export async function updateProjectStatus(id: string, status: string) {
  const supabase = await assertWrite();
  const { error } = await supabase.from("projects").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${id}`);
}

export async function updateWorkstreamStatus(id: string, status: string) {
  const supabase = await assertWrite();
  const { error } = await supabase.from("workstreams").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/proyectos");
  revalidatePath("/timeline");
  revalidatePath(`/workstreams/${id}`);
}

export async function updateWorkstream(formData: FormData) {
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
}

export async function addAssignment(formData: FormData) {
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
}

export async function removeAssignment(assignmentId: string, workstreamId: string) {
  const supabase = await assertWrite();
  const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/workstreams/${workstreamId}`);
  revalidatePath("/carga");
}

export async function setWeekTasks(workstreamId: string, weekStart: string, taskIds: string[]) {
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
}
