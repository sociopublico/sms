import { requireAdmin } from "@/lib/auth";
import { socioLocalPart } from "@/lib/emails";
import { createClient } from "@/lib/supabase/server";
import { addUser } from "../user-actions";
import { UserRoleCell } from "./UserRoleCell";
import { UserPersonCell } from "./UserPersonCell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormSelect } from "@/components/ui/FormSelect";
import { PageHeader } from "@/components/ui/PageHeader";
import { SocioEmailField } from "@/components/ui/SocioEmailField";
import { ROLE_LABEL, ROLE_OPTIONS, type RoleValue } from "@/lib/app-roles";

type UserRow = {
  email: string;
  role: RoleValue;
  personId: string | null;
};

export default async function UsersPage() {
  const session = await requireAdmin();
  const supabase = await createClient();
  const [
    { data: profiles },
    { data: invited },
    { data: editorRows },
    { data: adminRows },
    { data: people },
  ] = await Promise.all([
    supabase.from("profiles").select("email, app_role, person_id").order("email"),
    supabase.from("app_emails").select("email, app_role, person_id").order("email"),
    supabase.from("editor_emails").select("email").order("email"),
    supabase.from("admin_emails").select("email").order("email"),
    supabase
      .from("people")
      .select("id, display_name")
      .is("deleted_at", null)
      .order("display_name"),
  ]);

  const byEmail = new Map<string, UserRow>();

  const upsert = (email: string, patch: Partial<UserRow> & { role?: RoleValue }) => {
    const key = email.toLowerCase();
    const prev = byEmail.get(key);
    byEmail.set(key, {
      email: key,
      role: patch.role ?? prev?.role ?? "member",
      personId: patch.personId !== undefined ? patch.personId : (prev?.personId ?? null),
    });
  };

  for (const row of editorRows ?? []) {
    upsert(row.email, { role: "pm" });
  }
  for (const row of adminRows ?? []) {
    upsert(row.email, { role: "admin" });
  }
  for (const row of invited ?? []) {
    upsert(row.email, {
      role: (row.app_role as RoleValue) ?? "member",
      personId: row.person_id,
    });
  }
  for (const profile of profiles ?? []) {
    if (!profile.email) continue;
    upsert(profile.email, {
      role: (profile.app_role as RoleValue) ?? "member",
      personId: profile.person_id,
    });
  }

  const rows = [...byEmail.values()].sort((a, b) => {
    const rank = (r: string) => (r === "admin" ? 0 : r === "pm" ? 1 : r === "staff" ? 2 : 3);
    return rank(a.role) - rank(b.role) || a.email.localeCompare(b.email);
  });

  const peopleOptions = (people ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
  }));
  const linkedPersonIds = new Set(rows.map((r) => r.personId).filter(Boolean) as string[]);
  const availableForInvite = peopleOptions.filter((p) => !linkedPersonIds.has(p.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Cualquier cuenta @sociopublico.com entra como Lector. Al sumar a alguien podés asignarle un permiso y, si corresponde, vincularlo a una persona del catálogo."
      />
      <Card className="p-6">
        <form action={addUser} className="space-y-4">
          <Field label="Mail">
            <SocioEmailField />
          </Field>
          <Field label="Permiso">
            <FormSelect
              name="role"
              defaultValue="member"
              options={ROLE_OPTIONS.map((role) => ({
                value: role,
                label: ROLE_LABEL[role],
              }))}
            />
          </Field>
          <Field label="Persona">
            <FormSelect
              name="person_id"
              defaultValue=""
              placeholder="Sin vincular"
              options={[
                { value: "", label: "Sin vincular" },
                ...availableForInvite.map((person) => ({
                  value: person.id,
                  label: person.display_name,
                })),
              ]}
            />
          </Field>
          <Button type="submit" variant="primary">
            Agregar
          </Button>
        </form>
      </Card>
      <Card className="overflow-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Mail</th>
              <th className="px-4 py-3 font-medium">Permiso</th>
              <th className="px-4 py-3 font-medium">Persona</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email} className="border-b border-line last:border-0">
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
                <td className="px-4 py-3">
                  <UserPersonCell
                    email={row.email}
                    personId={row.personId}
                    people={peopleOptions.filter(
                      (p) => p.id === row.personId || !linkedPersonIds.has(p.id),
                    )}
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
