"use client";

import { useState } from "react";
import { AddWorkstreamForm } from "@/components/AddWorkstreamForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function AddWorkstreamSection({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      {open ? (
        <Card className="p-6">
          <h3 className="mb-3 text-sm font-medium text-muted">Agregar workstream</h3>
          <AddWorkstreamForm projectId={projectId} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 cursor-pointer text-xs text-muted hover:text-cyan"
          >
            Cancelar
          </button>
        </Card>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setOpen(true)} aria-expanded={false}>
          Agregar workstream
        </Button>
      )}
    </div>
  );
}
