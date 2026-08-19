"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type AppRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formPayload, withAudit } from "@/lib/audit";

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export async function addEditor(formData: FormData) {
  return withAudit(
    "users.add_editor",
    async () => {
      await requireAdmin();
      const supabase = await createClient();
      const email = normalizeEmail(String(formData.get("email") ?? ""));
      if (!email.endsWith("@sociopublico.com")) {
        throw new Error("Solo se permiten cuentas @sociopublico.com.");
      }
      const { error } = await supabase.rpc("add_editor", { p_email: email });
      if (error) throw new Error(error.message);
      revalidatePath("/usuarios");
    },
    formPayload(formData),
    { type: "user", id: normalizeEmail(String(formData.get("email") ?? "")) },
  );
}

export async function setUserRole(email: string, role: AppRole) {
  return withAudit(
    "users.set_role",
    async () => {
      await requireAdmin();
      const supabase = await createClient();
      const normalized = normalizeEmail(email);
      const { error } = await supabase.rpc("set_app_role", { p_email: normalized, p_role: role });
      if (error) throw new Error(error.message);
      revalidatePath("/usuarios");
    },
    { email, role },
    { type: "user", id: normalizeEmail(email) },
  );
}
