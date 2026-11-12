"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABEL, ROLE_OPTIONS, type RoleValue } from "@/lib/app-roles";

export { ROLE_LABEL, ROLE_OPTIONS, type RoleValue } from "@/lib/app-roles";

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
        <div className="absolute z-50 mt-1 min-w-44 rounded-2xl border border-line bg-paper p-1 shadow-md">
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-ink hover:bg-canvas"
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
