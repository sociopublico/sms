import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { NewWorkstreamForm } from "./NewWorkstreamForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function NewProjectPage() {
  const session = await requireSession();
  if (!session.canWrite) {
    return <p className="text-muted">No tenés permiso para crear proyectos.</p>;
  }
  const supabase = await createClient();
  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase.from("projects").select("id, code, clients(name)").order("code"),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Nuevo workstream"
        description="Podés colgarlo de un contrato existente o crear el proyecto junto con el workstream."
      />
      <Card className="p-6">
        <NewWorkstreamForm
          projects={(projects ?? []).map((p) => {
            const client = p.clients as { name: string } | { name: string }[] | null;
            const clientName = Array.isArray(client) ? client[0]?.name : client?.name;
            return { id: p.id, code: p.code, clientName: clientName ?? "" };
          })}
          clients={clients ?? []}
        />
      </Card>
    </div>
  );
}
