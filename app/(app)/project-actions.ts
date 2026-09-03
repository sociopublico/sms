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

function parseOptionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function parseOptionalDate(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function parseBillingPoint(formData: FormData) {
  const value = String(formData.get("billing_point") ?? "").trim();
  if (!value) return null;
  if (value !== "spuy" && value !== "spar") throw new Error("El punto de cobro es inválido.");
  return value;
}

async function resolveClientId(supabase: DbClient, formData: FormData, kind: string) {
  if (kind === "internal") return findOrCreateClient(supabase, INTERNAL_CLIENT_NAME);
  const clientId = String(formData.get("client_id") ?? "");
  const newName = String(formData.get("new_client_name") ?? "").trim();
  if (clientId && clientId !== "__new__") return clientId;
  if (!newName) throw new Error("El cliente es obligatorio.");
  return findOrCreateClient(supabase, newName);
}

function slugPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createProject(formData: FormData) {
  return withAudit(
    "projects.create",
    async () => {
      const supabase = await assertWrite();
      const kind = parseProjectKind(formData);
      const fichaUrl = parseOptionalHttpUrl(String(formData.get("ficha_url") ?? ""), "La URL de ficha");
      const status = String(formData.get("status") ?? "en_curso");
      const code = String(formData.get("code") ?? "").trim();
      const clientId = await resolveClientId(supabase, formData, kind);
      const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
      const clientName = client?.name ?? "cliente";
      const generatedCode =
        code || `sin-ficha-${slugPart(clientName)}-${Date.now().toString(36)}`;

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

      revalidatePath("/proyectos");
      revalidatePath("/timeline");
      redirect(`/proyectos/${project.id}`);
    },
    formPayload(formData),
  );
}

export async function createWorkstream(formData: FormData) {
  return withAudit(
    "workstreams.create",
    async () => {
      const supabase = await assertWrite();
      const projectId = String(formData.get("project_id") ?? "").trim();
      const name = String(formData.get("workstream_name") ?? "").trim();
      const status = String(formData.get("status") ?? "en_curso");
      if (!projectId) throw new Error("El proyecto es obligatorio.");
      if (!name) throw new Error("El workstream es obligatorio.");

      const payload: Record<string, unknown> = {
        project_id: projectId,
        name,
        status,
      };
      if (status === "mantenimiento") {
        const start = mondayOf(new Date());
        payload.start_on = toISODate(start);
        payload.end_on = toISODate(addWeeks(start, 52));
      }

      const { data: ws, error } = await supabase.from("workstreams").insert(payload).select("id").single();
      if (error) throw new Error(error.message);

      revalidatePath("/proyectos");
      revalidatePath(`/proyectos/${projectId}`);
      revalidatePath("/timeline");
      redirect(`/workstreams/${ws.id}`);
    },
    formPayload(formData),
    { type: "project", id: String(formData.get("project_id") ?? "") || undefined },
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
          ficha_url: parseOptionalHttpUrl(String(formData.get("ficha_url") ?? ""), "La URL de ficha"),
          partner: parseOptionalText(formData, "partner"),
          contract_signed_on: parseOptionalDate(formData, "contract_signed_on"),
          proposal_url: parseOptionalHttpUrl(String(formData.get("proposal_url") ?? ""), "El link a la propuesta"),
          drive_folder_url: parseOptionalHttpUrl(
            String(formData.get("drive_folder_url") ?? ""),
            "El link de la carpeta general",
          ),
          planned_duration: parseOptionalText(formData, "planned_duration"),
          kickoff_on: parseOptionalDate(formData, "kickoff_on"),
          end_on: parseOptionalDate(formData, "end_on"),
          payment_schedule: parseOptionalText(formData, "payment_schedule"),
          billing_point: parseBillingPoint(formData),
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
