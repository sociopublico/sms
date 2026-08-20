import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HoursSyncPanel } from "@/components/HoursSyncPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { DRIVE_ROOT_FOLDER_ID } from "@/lib/drive-constants";
import { monthLabelEs } from "@/lib/toggl-import";

export default async function HorasSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await requireWriter();
  const { connected, error } = await searchParams;
  const supabase = await createClient();
  const [{ data: files }, { data: connection }] = await Promise.all([
    supabase
      .from("drive_hours_files")
      .select(
        "id, file_name, folder_name, person_id, inferred_month, status, synced_at, error_message, people(display_name)",
      )
      .order("folder_name")
      .order("inferred_month", { ascending: true, nullsFirst: false })
      .order("file_name"),
    supabase
      .from("drive_connections")
      .select("connected_by, connected_at, root_folder_id")
      .eq("provider", "google")
      .maybeSingle(),
  ]);

  let connectedEmail: string | null = null;
  if (connection?.connected_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", connection.connected_by)
      .maybeSingle();
    connectedEmail = profile?.email ?? null;
  }

  type FileRow = {
    id: string;
    fileName: string;
    folderName: string;
    personId: string | null;
    personName: string | null;
    inferredMonth: string | null;
    monthLabel: string | null;
    status: string;
    syncedAt: string | null;
    errorMessage: string | null;
  };

  const mapped: FileRow[] = (files ?? []).map((file) => {
    const person = file.people as { display_name: string } | { display_name: string }[] | null;
    const personName = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
    return {
      id: file.id,
      fileName: file.file_name,
      folderName: file.folder_name ?? "—",
      personId: file.person_id,
      personName: personName ?? null,
      inferredMonth: file.inferred_month,
      monthLabel: file.inferred_month ? monthLabelEs(file.inferred_month) : null,
      status: file.status,
      syncedAt: file.synced_at,
      errorMessage: file.error_message,
    };
  });

  const byPerson = new Map<
    string,
    {
      personName: string;
      files: FileRow[];
      loaded: number;
      pending: number;
      incompatible: number;
    }
  >();

  for (const file of mapped) {
    const key = file.personId ?? `folder:${file.folderName}`;
    const label = file.personName ?? `${file.folderName} (sin persona)`;
    let group = byPerson.get(key);
    if (!group) {
      group = { personName: label, files: [], loaded: 0, pending: 0, incompatible: 0 };
      byPerson.set(key, group);
    }
    group.files.push(file);
    if (file.status === "pending") group.pending += 1;
    else if (file.status === "error") group.incompatible += 1;
    else group.loaded += 1; // synced | skipped
  }

  const groups = [...byPerson.values()].sort((a, b) =>
    a.personName.localeCompare(b.personName, "es"),
  );

  let banner: { kind: "ok" | "error"; text: string } | null = null;
  if (error) banner = { kind: "error", text: error };
  else if (connected === "1" && connection) {
    banner = { kind: "ok", text: "Drive quedó conectado." };
  } else if (connected === "1" && !connection) {
    banner = {
      kind: "error",
      text: "Volviste del consent de Google pero no se guardó el refresh token. Revisá scopes y volvé a conectar.",
    };
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Sync de horas"
        description="Estado de los CSV por persona y carga de horas pendientes."
        actions={
          <a href="/horas" className="text-sm font-medium text-cyan hover:text-cyan">
            ← Matriz de horas
          </a>
        }
      />
      <HoursSyncPanel
        isAdmin={session.isAdmin}
        driveConnected={Boolean(connection)}
        connectedEmail={connectedEmail}
        connectedAt={connection?.connected_at ?? null}
        rootFolderId={connection?.root_folder_id || DRIVE_ROOT_FOLDER_ID}
        banner={banner}
        groups={groups.map((group) => ({
          personName: group.personName,
          loaded: group.loaded,
          pending: group.pending,
          incompatible: group.incompatible,
          files: group.files,
        }))}
      />
    </div>
  );
}
