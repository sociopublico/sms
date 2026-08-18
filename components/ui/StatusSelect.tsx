"use client";

import { useRef, useState, useTransition } from "react";
import { STATUS_LABEL, STATUS_OPTIONS } from "@/lib/dates";
import { Badge } from "@/components/ui/Badge";

export function StatusSelect({
  value,
  canWrite,
  onChange,
}: {
  value: string;
  canWrite: boolean;
  onChange: (status: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  if (!canWrite) {
    return <Badge status={value}>{STATUS_LABEL[value] ?? value}</Badge>;
  }

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer"
      >
        <Badge status={value}>{STATUS_LABEL[value] ?? value}</Badge>
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 min-w-40 rounded-2xl border border-line bg-white p-1">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className="flex w-full items-center rounded-xl px-2 py-1.5 text-left hover:bg-canvas"
              onClick={() => {
                setOpen(false);
                if (status === value) return;
                startTransition(async () => {
                  await onChange(status);
                });
              }}
            >
              <Badge status={status}>{STATUS_LABEL[status]}</Badge>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
