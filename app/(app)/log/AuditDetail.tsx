"use client";

import { useState } from "react";

export function AuditDetail({ payload, error }: { payload: unknown; error: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-cyan hover:underline">
        {open ? "Ocultar" : "Ver detalle"}
      </button>
      {open ? (
        <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-canvas p-3 text-xs text-navy">
          {error ? `Error: ${error}\n\n` : ""}
          {JSON.stringify(payload ?? {}, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
