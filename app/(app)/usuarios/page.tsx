import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addEditor } from "../user-actions";
import { UserRoleCell } from "./UserRoleCell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import type { RoleValue } from "@/components/ui/RoleSelect";

export default async function UsersPage() {
  const session = await requireAdmin();
  const supabase = await createClient();
  const [{ data: profiles }, { data: editorRows }, { data: adminRows }] = await Promise.all([
    supabase.from("profiles").select("email, app_role").order("email"),
    supabase.from("editor_emails").select("email").order("email"),
    supabase.from("admin_emails").select("email").order("email"),
  ]);

  const byEmail = new Map<string, RoleValue>();
  for (const row of editorRows ?? []) {
    byEmail.set(row.email.toLowerCase(), "pm");
  }
  for (const row of adminRows ?? []) {
    byEmail.set(row.email.toLowerCase(), "admin");
  }
  for (const profile of profiles ?? []) {
    if (!profile.email) continue;
    byEmail.set(profile.email.toLowerCase(), (profile.app_role as RoleValue) ?? "member");
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
        description="Lector ve. Editor carga timelines y catálogo. Admin también gestiona permisos y el log."
      />
      <Card className="p-5">
        <form action={addEditor} className="flex flex-wrap items-end gap-3">
          <Field label="Invitar editor" className="min-w-72">
            <input
              name="email"
              type="email"
              required
              placeholder="nombre@sociopublico.com"
              className={fieldControlClass}
            />
          </Field>
          <Button type="submit">Agregar</Button>
        </form>
      </Card>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Mail</th>
              <th className="px-4 py-3 font-medium">Permiso</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{row.email}</td>
                <td className="px-4 py-3">
                  <UserRoleCell
                    email={row.email}
                    role={row.role}
                    locked={row.email === session.email?.toLowerCase()}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
