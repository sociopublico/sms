import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "pm" | "member";

export type SessionProfile = {
  id: string;
  email: string | null;
  appRole: AppRole;
  canWrite: boolean;
  isAdmin: boolean;
};

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", claims.sub)
    .maybeSingle();

  const appRole = (profile?.app_role as AppRole | undefined) ?? "member";
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    appRole,
    canWrite: appRole === "admin" || appRole === "pm",
    isAdmin: appRole === "admin",
  };
}

export async function requireSession() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin() {
  const profile = await requireSession();
  if (!profile.isAdmin) redirect("/timeline");
  return profile;
}
