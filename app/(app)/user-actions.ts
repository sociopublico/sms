"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ADMINS = ["agustina@sociopublico.com", "alejandra@sociopublico.com"];

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export async function addEditor(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email.endsWith("@sociopublico.com")) {
    throw new Error("Solo se permiten cuentas @sociopublico.com.");
  }
  if (ADMINS.includes(email)) {
    throw new Error("Esa cuenta ya es admin.");
  }
  const { error } = await supabase.rpc("add_editor", { p_email: email });
  if (error) throw new Error(error.message);
  revalidatePath("/usuarios");
}

export async function removeEditor(email: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_editor", { p_email: normalizeEmail(email) });
  if (error) throw new Error(error.message);
  revalidatePath("/usuarios");
}
