export const ROLE_OPTIONS = ["member", "staff", "pm", "admin"] as const;
export type RoleValue = (typeof ROLE_OPTIONS)[number];

export const ROLE_LABEL: Record<RoleValue, string> = {
  member: "Lector",
  staff: "Staff",
  pm: "Editor",
  admin: "Admin",
};
