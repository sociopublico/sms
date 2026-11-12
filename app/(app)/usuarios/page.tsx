import { requireAdmin } from "@/lib/auth";
import { socioLocalPart } from "@/lib/emails";
import { createClient } from "@/lib/supabase/server";
import { renamePerson } from "../catalog-actions";
import { addUser } from "../user-actions";
import { UserRoleCell } from "./UserRoleCell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SocioEmailField } from "@/components/ui/SocioEmailField";
import { ROLE_LABEL, type RoleValue } from "@/components/ui/RoleSelect";

export default async function UsersPage() {
  const session = await requireAdmin();
  const supabase = await createClient();
  const [{ data: profiles }, { data: invited }, { data: editorRows }, { data: adminRows }] = await Promise.all([
    supabase.from("profiles").select("email, app_role, person_id, people(display_name)").order("email"),
    supabase.from("app_emails").select("email, app_role").order("email"),
    supabase.from("editor_emails").select("email").order("email"),
    supabase.from("admin_emails").select("email").order("email"),
  ]);

  const byEmail = new Map<string, { role: RoleValue; personId: string | null; displayName: string | null }>();
  function touch(email: string) {
    const key = email.toLowerCase();
    const current = byEmail.get(key) ?? { role: "member" as RoleValue, personId: null, displayName: null };
    byEmail.set(key, current);
    return current;
  }
  for (const row of editorRows ?? []) touch(row.email).role = "pm";
  for (const row of adminRows ?? []) touch(row.email).role = "admin";
  for (const row of invited ?? []) touch(row.email).role = (row.app_role as RoleValue) ?? "member";
  for (const profile of profiles ?? []) {
    if (!profile.email) continue;
    const row = touch(profile.email);
    row.role = (profile.app_role as RoleValue) ?? "member";
    row.personId = profile.person_id;
    const person = profile.people as { display_name: string } | { display_name: string }[] | null;
    row.displayName = Array.isArray(person) ? (person[0]?.display_name ?? null) : (person?.display_name ?? null);
  }

  const rows = [...byEmail.entries()]
    .map(([email, row]) => ({ email, ...row }))
    .sort((a, b) => {
      const rank = (r: string) => (r === "admin" ? 0 : r === "pm" ? 1 : 2);
      return rank(a.role) - rank(b.role) || a.email.localeCompare(b.email);
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Cualquier cuenta @sociopublico.com entra como Lector. El nombre de la barra es el de la persona vinculada: si está, lo podés cambiar acá."
      />
      <Card className="p-6">
        <form action={addUser} className="space-y-4">
          <Field label="Mail">
            <SocioEmailField />
          </Field>
          <Field label="Permiso">
            <select name="role" defaultValue="member" className={fieldControlClass}>
              <option value="member">{ROLE_LABEL.member}</option>
              <option value="pm">{ROLE_LABEL.pm}</option>
              <option value="admin">{ROLE_LABEL.admin}</option>
            </select>
          </Field>
          <Button type="submit" variant="primary">
            Agregar
          </Button>
        </form>
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Mail</th>
              <th className="px-4 py-3 font-medium">Permiso</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  {row.personId ? (
                    <form action={renamePerson.bind(null, row.personId)} className="flex items-center gap-2">
                      <input
                        name="display_name"
                        required
                        defaultValue={row.displayName ?? ""}
                        aria-label={`Nombre de ${row.email}`}
                        className={`${fieldControlClass} max-w-48`}
                      />
                      <button type="submit" className="text-sm text-navy hover:text-cyan">
                        Guardar
                      </button>
                    </form>
                  ) : (
                    <span className="text-muted">Sin persona</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-ink">
                  {socioLocalPart(row.email)}
                  <span className="font-normal text-muted">@sociopublico.com</span>
                </td>
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
