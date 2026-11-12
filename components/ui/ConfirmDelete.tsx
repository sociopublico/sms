"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function ConfirmDelete({
  label,
  action,
  title,
  description,
  confirmLabel = "Eliminar",
  triggerLabel,
  triggerClassName,
}: {
  label: string;
  action: () => Promise<unknown>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = triggerRef.current;
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [open, pending]);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await action();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setPending(false);
    }
  }

  const heading = title ?? `¿Eliminar ${label}?`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel ? undefined : `Eliminar ${label}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={
          triggerClassName ??
          "inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-muted hover:bg-canvas hover:text-danger"
        }
      >
        {triggerLabel ?? "×"}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-navy/40 p-4"
          onClick={() => {
            if (!pending) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className="w-full max-w-sm rounded-2xl border border-line bg-paper p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="text-base font-medium text-ink">
              {heading}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-2 text-sm text-muted">
                {description}
              </p>
            ) : null}
            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                ref={cancelRef}
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="button" variant="danger" onClick={confirm} disabled={pending}>
                {pending ? "Esperá…" : confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
