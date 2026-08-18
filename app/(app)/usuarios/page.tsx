import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addEditor, removeEditor } from "../user-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";

const ADMINS = ["agustina@sociopublico.com", "alejandra@sociopublico.com"];

export default async function UsersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: profiles }, { data: editorRows }] = await Promise.all([
    supabase.from("profiles").select("email, app_role").order("email"),
    supabase.from("editor_emails").select("email").order("email"),
  ]);

  const byEmail = new Map(
    (profiles ?? [])
      .filter((p) => p.email)
      .map((p) => [p.email!.toLowerCase(), p.app_role as string]),
  );
  for (const row of editorRows ?? []) {
    if (!byEmail.has(row.email)) byEmail.set(row.email, "pm");
  }
  for (const email of ADMINS) {
    byEmail.set(email, "admin");
  }

  const rows = [...byEmail.entries()]
    .map(([email, role]) => ({ email, role }))
    .sort((a, b) => {
      const rank = (r: string) => (r === "admin" ? 0 : r === "pm" ? 1 : 2);
      return rank(a.role) - rank(b.role) || a.email.localeCompare(b.email);
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Agustina y Alejandra administran quién puede editar. El resto del estudio entra en lectura."
      />
      <Card className="p-5">
        <form action={addEditor} className="flex flex-wrap items-end gap-3">
          <Field label="Mail de editor" className="min-w-72">
            <input
              name="email"
              type="email"
              required
              placeholder="nombre@sociopublico.com"
              className={fieldControlClass}
            />
          </Field>
          <Button type="submit">Agregar editor</Button>
        </form>
      </Card>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Mail</th>
              <th className="px-4 py-3 font-medium">Permiso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{row.email}</td>
                <td className="px-4 py-3 text-muted">
                  {row.role === "admin" ? "Admin" : row.role === "pm" ? "Editor" : "Lectura"}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.role === "pm" ? (
                    <ConfirmDelete label={row.email} action={removeEditor.bind(null, row.email)} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
