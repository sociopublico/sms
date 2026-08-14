"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function assertWrite() {
  const session = await requireSession();
  if (!session.canWrite) throw new Error("No tenés permiso para editar.");
  return createClient();
}

export async function upsertPerson(formData: FormData) {
  const supabase = await assertWrite();
  const id = String(formData.get("id") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const roleIds = formData.getAll("role_ids").map(String).filter(Boolean);
  if (!displayName) throw new Error("El nombre es obligatorio.");

  let personId = id;
  if (id) {
    const { error } = await supabase
      .from("people")
      .update({ display_name: displayName, deleted_at: null })
      .eq("id", id);
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
}

export async function archivePerson(personId: string) {
  const supabase = await assertWrite();
  const { error } = await supabase
    .from("people")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", personId);
  if (error) throw new Error(error.message);
  revalidatePath("/personas");
  revalidatePath("/carga");
}

export async function restorePerson(personId: string) {
  const supabase = await assertWrite();
  const { error } = await supabase.from("people").update({ deleted_at: null }).eq("id", personId);
  if (error) throw new Error(error.message);
  revalidatePath("/personas");
}

export async function upsertRole(formData: FormData) {
  const supabase = await assertWrite();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const alwaysOnDuty = formData.get("always_on_duty") === "on";
  if (!name) throw new Error("El nombre es obligatorio.");
  if (id) {
    const { error } = await supabase
      .from("roles")
      .update({ name, always_on_duty: alwaysOnDuty })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("roles").insert({ name, always_on_duty: alwaysOnDuty });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/roles");
}

export async function deleteRole(roleId: string) {
  const supabase = await assertWrite();
  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) throw new Error(error.message);
  revalidatePath("/roles");
}

export async function upsertTask(formData: FormData) {
  const supabase = await assertWrite();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#64748b");
  const roleIds = formData.getAll("role_ids").map(String).filter(Boolean);
  if (!name) throw new Error("El nombre es obligatorio.");

  let taskId = id;
  if (id) {
    const { error } = await supabase.from("tasks").update({ name, color }).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ name, color })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    taskId = data.id;
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
}

export async function deleteTask(taskId: string) {
  const supabase = await assertWrite();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/tareas");
}
