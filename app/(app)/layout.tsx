import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { AuditPageView } from "@/components/AuditPageView";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return (
    <AppShell email={session.email} canWrite={session.canWrite} isAdmin={session.isAdmin}>
      <Suspense fallback={null}>
        <AuditPageView />
      </Suspense>
      {children}
    </AppShell>
  );
}
