"use client";

import { setUserRole } from "../user-actions";
import { RoleSelect } from "@/components/ui/RoleSelect";
import type { RoleValue } from "@/lib/app-roles";

export function UserRoleCell({
  email,
  role,
  locked,
}: {
  email: string;
  role: RoleValue;
  locked?: boolean;
}) {
  return <RoleSelect value={role} disabled={locked} onChange={(next) => setUserRole(email, next)} />;
}
