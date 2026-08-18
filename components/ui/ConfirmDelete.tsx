"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";

export function ConfirmDelete({
  label,
  action,
}: {
  label: string;
  action: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  async function confirm() {
    setPending(true);
    try {
      await action();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Eliminar ${label}`}
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-muted hover:bg-canvas hover:text-danger"
      >
        ×
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-navy/40 p-4"
          onClick={() => {
            if (!pending) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="text-base font-medium text-ink">
              ¿Eliminar {label}?
            </h2>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className="inline-flex items-center justify-center rounded-full bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
