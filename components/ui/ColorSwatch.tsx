"use client";

import { useState } from "react";
import { TASK_COLORS, isPaletteColor } from "@/lib/colors";

export function ColorSwatch({ name = "color", defaultValue = TASK_COLORS[0] }: { name?: string; defaultValue?: string }) {
  const initial = defaultValue || TASK_COLORS[0];
  const [value, setValue] = useState(initial);
  const [customOpen, setCustomOpen] = useState(!isPaletteColor(initial));

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1.5">
        {TASK_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => {
              setValue(color);
              setCustomOpen(false);
            }}
            className={`h-7 w-7 rounded-full border ${
              value.toLowerCase() === color.toLowerCase() ? "ring-2 ring-cyan ring-offset-2" : "border-line"
            }`}
            style={{ background: color }}
          />
        ))}
        {customOpen && !isPaletteColor(value) ? (
          <span
            className="h-7 w-7 rounded-full border border-line ring-2 ring-cyan ring-offset-2"
            style={{ background: value }}
          />
        ) : null}
      </div>
      {customOpen ? (
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10 w-24 cursor-pointer rounded-xl border border-line bg-paper"
        />
      ) : (
        <button
          type="button"
          className="text-sm text-navy hover:text-cyan"
          onClick={() => setCustomOpen(true)}
        >
          Otro color
        </button>
      )}
    </div>
  );
}
