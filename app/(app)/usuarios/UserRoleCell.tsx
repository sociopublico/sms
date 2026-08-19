"use client";

import { setUserRole } from "../user-actions";
import { RoleSelect, type RoleValue } from "@/components/ui/RoleSelect";

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
