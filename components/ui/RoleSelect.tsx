"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";

export const ROLE_OPTIONS = ["member", "pm", "admin"] as const;
export type RoleValue = (typeof ROLE_OPTIONS)[number];

export const ROLE_LABEL: Record<RoleValue, string> = {
  member: "Lector",
  pm: "Editor",
  admin: "Admin",
};

export function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: RoleValue;
  disabled?: boolean;
  onChange: (role: RoleValue) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  if (disabled) {
    return <Badge status={value}>{ROLE_LABEL[value]}</Badge>;
  }

  return (
    <div ref={box} className="relative inline-block">
      <button type="button" disabled={pending} onClick={() => setOpen((v) => !v)} className="cursor-pointer">
        <Badge status={value}>{ROLE_LABEL[value]}</Badge>
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 min-w-40 rounded-2xl border border-line bg-white p-1">
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              className="flex w-full items-center rounded-xl px-2 py-1.5 text-left hover:bg-canvas"
              onClick={() => {
                setOpen(false);
                if (role === value) return;
                startTransition(async () => {
                  await onChange(role);
                });
              }}
            >
              <Badge status={role}>{ROLE_LABEL[role]}</Badge>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
