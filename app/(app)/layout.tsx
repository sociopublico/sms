import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { AuditPageView } from "@/components/AuditPageView";

function displayNameFromEmail(email: string | null) {
  if (!email) return "Usuario";
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("person_id, people(display_name)")
    .eq("id", session.id)
    .maybeSingle();

  const person = profile?.people as { display_name: string } | { display_name: string }[] | null;
  const personName = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
  const displayName = personName || displayNameFromEmail(session.email);

  return (
    <AppShell displayName={displayName} canWrite={session.canWrite} isAdmin={session.isAdmin}>
      <Suspense fallback={null}>
        <AuditPageView />
      </Suspense>
      {children}
    </AppShell>
  );
}
