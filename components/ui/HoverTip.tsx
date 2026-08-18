"use client";

import { useState, type ReactNode } from "react";

export function HoverTip({
  content,
  children,
}: {
  content: ReactNode;
  children: ReactNode;
}) {
  const [tip, setTip] = useState<{ top: number; left: number; place: "left" | "right" } | null>(null);

  function show(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const place: "left" | "right" = window.innerWidth - r.right > 220 ? "right" : "left";
    setTip({
      top: r.top + r.height / 2,
      left: place === "right" ? r.right + 8 : r.left - 8,
      place,
    });
  }

  return (
    <span
      className="inline-flex"
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setTip(null)}
    >
      {children}
      {tip ? (
        <span
          className="pointer-events-none fixed z-[110] max-w-xs rounded-2xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink"
          style={{
            top: tip.top,
            left: tip.left,
            transform: tip.place === "right" ? "translateY(-50%)" : "translate(-100%, -50%)",
          }}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
