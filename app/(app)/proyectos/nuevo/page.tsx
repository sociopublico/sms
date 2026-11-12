import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { NewProjectForm } from "./NewProjectForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function NewProjectPage() {
  const session = await requireSession();
  if (!session.canWrite) {
    return <p className="text-muted">No tenés permiso para crear proyectos.</p>;
  }
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Nuevo proyecto"
        description="Alta del contrato (cliente, ID, ficha y datos opcionales). El workstream se agrega después desde la ficha."
      />
      <Card className="p-6">
        <NewProjectForm clients={clients ?? []} />
      </Card>
    </div>
  );
}
