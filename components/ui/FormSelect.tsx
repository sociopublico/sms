"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fieldControlClass } from "@/components/ui/Field";

export type FormSelectOption = { value: string; label: string };

export function FormSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Elegir…",
  required,
  onChange,
}: {
  name?: string;
  options: FormSelectOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative w-full">
      {name ? (
        <input type="hidden" name={name} value={value} required={required && !value ? true : undefined} />
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`${fieldControlClass} flex w-full items-center justify-between gap-2 text-left`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? "text-ink" : "text-muted"}>{label}</span>
        <span className="text-muted" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line bg-paper py-1 shadow-md"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value || "__empty"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full px-3 py-2 text-left text-sm text-ink hover:bg-canvas ${
                    active ? "bg-canvas font-medium" : ""
                  }`}
                  onClick={() => {
                    setValue(option.value);
                    setOpen(false);
                    onChange?.(option.value);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
