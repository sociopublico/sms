import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return (
    <AppShell email={session.email} canWrite={session.canWrite} isAdmin={session.isAdmin}>
      {children}
    </AppShell>
  );
}
