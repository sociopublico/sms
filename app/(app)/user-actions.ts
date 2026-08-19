"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type AppRole } from "@/lib/auth";
import { toSocioEmail } from "@/lib/emails";
import { createClient } from "@/lib/supabase/server";
import { formPayload, withAudit } from "@/lib/audit";

function parseRole(raw: string): AppRole {
  if (raw === "admin" || raw === "pm" || raw === "member") return raw;
  throw new Error("Permiso inválido.");
}

export async function addUser(formData: FormData) {
  const email = toSocioEmail(String(formData.get("local_part") ?? ""));
  const role = parseRole(String(formData.get("role") ?? "member"));
  return withAudit(
    "users.add_user",
    async () => {
      await requireAdmin();
      const supabase = await createClient();
      const { error } = await supabase.rpc("set_app_role", { p_email: email, p_role: role });
      if (error) throw new Error(error.message);
      revalidatePath("/usuarios");
    },
    formPayload(formData),
    { type: "user", id: email },
  );
}

export async function setUserRole(email: string, role: AppRole) {
  const normalized = toSocioEmail(email);
  return withAudit(
    "users.set_role",
    async () => {
      await requireAdmin();
      const supabase = await createClient();
      const { error } = await supabase.rpc("set_app_role", { p_email: normalized, p_role: role });
      if (error) throw new Error(error.message);
      revalidatePath("/usuarios");
    },
    { email: normalized, role },
    { type: "user", id: normalized },
  );
}
