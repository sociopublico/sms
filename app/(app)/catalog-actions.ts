"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formPayload, withAudit } from "@/lib/audit";

async function assertWrite() {
  const session = await requireSession();
  if (!session.canWrite) throw new Error("No tenés permiso para editar.");
  return createClient();
}

export async function upsertPerson(formData: FormData) {
  return withAudit(
    "catalog.upsert_person",
    async () => {
      const supabase = await assertWrite();
      const id = String(formData.get("id") ?? "");
      const displayName = String(formData.get("display_name") ?? "").trim();
      const roleIds = formData.getAll("role_ids").map(String).filter(Boolean);
      if (!displayName) throw new Error("El nombre es obligatorio.");

      let personId = id;
      if (id) {
        const { error } = await supabase.from("people").update({ display_name: displayName }).eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("people")
          .insert({ display_name: displayName })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        personId = data.id;
      }

      await supabase.from("person_roles").delete().eq("person_id", personId);
      if (roleIds.length) {
        const { error } = await supabase
          .from("person_roles")
          .insert(roleIds.map((role_id) => ({ person_id: personId, role_id })));
        if (error) throw new Error(error.message);
      }
      revalidatePath("/personas");
    },
    formPayload(formData),
    { type: "person", id: String(formData.get("id") ?? "") || undefined },
  );
}

export async function setPersonHidden(personId: string, hidden: boolean) {
  return withAudit(
    "catalog.set_person_hidden",
    async () => {
      const supabase = await assertWrite();
      const { error } = await supabase.from("people").update({ hidden }).eq("id", personId);
      if (error) throw new Error(error.message);
      revalidatePath("/personas");
      revalidatePath("/carga");
      revalidatePath("/timeline");
    },
    { personId, hidden },
    { type: "person", id: personId },
  );
}

export async function upsertRole(formData: FormData) {
  return withAudit(
    "catalog.upsert_role",
    async () => {
      const supabase = await assertWrite();
      const id = String(formData.get("id") ?? "");
      const name = String(formData.get("name") ?? "").trim();
      const alwaysOnDuty = formData.get("always_on_duty") === "on";
      if (!name) throw new Error("El nombre es obligatorio.");
      if (id) {
        const { error } = await supabase
          .from("roles")
          .update({ name, always_on_duty: alwaysOnDuty, deleted_at: null })
          .eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { data: archived } = await supabase
          .from("roles")
          .select("id")
          .eq("name", name)
          .not("deleted_at", "is", null)
          .maybeSingle();
        if (archived) {
          const { error } = await supabase
            .from("roles")
            .update({ always_on_duty: alwaysOnDuty, deleted_at: null })
            .eq("id", archived.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("roles").insert({ name, always_on_duty: alwaysOnDuty });
          if (error) throw new Error(error.message);
        }
      }
      revalidatePath("/roles");
    },
    formPayload(formData),
    { type: "role", id: String(formData.get("id") ?? "") || undefined },
  );
}

export async function archiveRole(roleId: string) {
  return withAudit(
    "catalog.archive_role",
    async () => {
      const supabase = await assertWrite();
      const { error } = await supabase
        .from("roles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", roleId);
      if (error) throw new Error(error.message);
      revalidatePath("/roles");
      revalidatePath("/carga");
    },
    { roleId },
    { type: "role", id: roleId },
  );
}

export async function upsertTask(formData: FormData) {
  return withAudit(
    "catalog.upsert_task",
    async () => {
      const supabase = await assertWrite();
      const id = String(formData.get("id") ?? "");
      const name = String(formData.get("name") ?? "").trim();
      const color = String(formData.get("color") ?? "#4A9BE8");
      const roleIds = formData.getAll("role_ids").map(String).filter(Boolean);
      if (!name) throw new Error("El nombre es obligatorio.");

      let taskId = id;
      if (id) {
        const { error } = await supabase.from("tasks").update({ name, color, deleted_at: null }).eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { data: archived } = await supabase
          .from("tasks")
          .select("id")
          .eq("name", name)
          .not("deleted_at", "is", null)
          .maybeSingle();
        if (archived) {
          taskId = archived.id;
          const { error } = await supabase
            .from("tasks")
            .update({ color, deleted_at: null })
            .eq("id", taskId);
          if (error) throw new Error(error.message);
        } else {
          const { data, error } = await supabase.from("tasks").insert({ name, color }).select("id").single();
          if (error) throw new Error(error.message);
          taskId = data.id;
        }
      }

      await supabase.from("task_roles").delete().eq("task_id", taskId);
      if (roleIds.length) {
        const { error } = await supabase
          .from("task_roles")
          .insert(roleIds.map((role_id) => ({ task_id: taskId, role_id })));
        if (error) throw new Error(error.message);
      }
      revalidatePath("/tareas");
      revalidatePath("/timeline");
    },
    formPayload(formData),
    { type: "task", id: String(formData.get("id") ?? "") || undefined },
  );
}

export async function archiveTask(taskId: string) {
  return withAudit(
    "catalog.archive_task",
    async () => {
      const supabase = await assertWrite();
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw new Error(error.message);
      revalidatePath("/tareas");
      revalidatePath("/timeline");
    },
    { taskId },
    { type: "task", id: taskId },
  );
}
