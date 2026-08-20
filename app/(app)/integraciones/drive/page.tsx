import { redirect } from "next/navigation";

export default async function DriveIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const params = new URLSearchParams();
  if (connected) params.set("connected", connected);
  if (error) params.set("error", error);
  const qs = params.toString();
  redirect(qs ? `/horas/sync?${qs}` : "/horas/sync");
}
