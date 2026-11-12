"use client";

import { useState, type ReactNode } from "react";
import {
  archiveDeliverable,
  createDeliverable,
  updateDeliverable,
} from "@/app/(app)/deliverable-actions";
import { AngleIcon } from "@/components/ui/AngleIcon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldControlClass } from "@/components/ui/Field";

export type DeliverableItem = {
  id: string;
  kind: "product" | "hours" | string;
  description: string;
  triggers_invoice: boolean;
  invoice_percent: number | string;
  delivery_on: string | null;
  url: string | null;
  invoiced: boolean;
  sort_order: number;
};

const checkboxClass = "mt-1 h-4 w-4 rounded border-line text-cyan accent-cyan";

function kindLabel(kind: string) {
  if (kind === "product") return "Producto";
  if (kind === "hours") return "Horas";
  return kind;
}

function formatDay(iso: string | null | undefined) {
  if (!iso) return "Sin fecha";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function toPercentNumber(value: number | string) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatPercent(value: number | string) {
  return `${toPercentNumber(value)} %`;
}

function MetaPill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "ok" | "warn" }) {
  const toneClass =
    tone === "ok" ? "bg-green/15 text-ink" : tone === "warn" ? "bg-danger/10 text-danger" : "bg-canvas text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function DeliverableFields({ defaults }: { defaults?: Partial<DeliverableItem> }) {
  return (
    <>
      <Field label="Tipo">
        <select name="kind" required defaultValue={defaults?.kind ?? "product"} className={fieldControlClass}>
          <option value="product">Producto</option>
          <option value="hours">Horas</option>
        </select>
      </Field>
      <Field label="Descripción">
        <input
          name="description"
          required
          defaultValue={defaults?.description ?? ""}
          className={fieldControlClass}
        />
      </Field>
      <label className="flex items-start gap-2 text-sm text-navy">
        <input
          type="checkbox"
          name="triggers_invoice"
          value="true"
          defaultChecked={defaults?.triggers_invoice ?? false}
          className={checkboxClass}
        />
        <span className="font-medium">Dispara factura</span>
      </label>
      <Field label="Porcentaje de facturación">
        <input
          name="invoice_percent"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.invoice_percent ?? 0}
          className={fieldControlClass}
        />
      </Field>
      <Field label="Fecha de entrega">
        <input
          name="delivery_on"
          type="date"
          defaultValue={defaults?.delivery_on ?? ""}
          className={fieldControlClass}
        />
      </Field>
      <Field label="Link al entregable">
        <input
          name="url"
          type="url"
          inputMode="url"
          defaultValue={defaults?.url ?? ""}
          placeholder="https://"
          title="Ingresá una URL que empiece con http:// o https://"
          className={fieldControlClass}
        />
      </Field>
      <label className="flex items-start gap-2 text-sm text-navy">
        <input
          type="checkbox"
          name="invoiced"
          value="true"
          defaultChecked={defaults?.invoiced ?? false}
          className={checkboxClass}
        />
        <span className="font-medium">Facturado</span>
      </label>
    </>
  );
}

function DeliverableDetails({ item }: { item: DeliverableItem }) {
  return (
    <dl className="space-y-2 border-t border-line pt-3 text-sm">
      <div>
        <dt className="font-medium text-navy">Tipo</dt>
        <dd className="text-ink">{kindLabel(item.kind)}</dd>
      </div>
      <div>
        <dt className="font-medium text-navy">Dispara factura</dt>
        <dd className="text-ink">{item.triggers_invoice ? "Sí" : "No"}</dd>
      </div>
      <div>
        <dt className="font-medium text-navy">Porcentaje</dt>
        <dd className="text-ink">{formatPercent(item.invoice_percent)}</dd>
      </div>
      <div>
        <dt className="font-medium text-navy">Link</dt>
        <dd className="text-ink">
          {item.url ? (
            <a href={item.url} className="break-all text-cyan hover:underline" target="_blank" rel="noreferrer">
              {item.url}
            </a>
          ) : (
            "—"
          )}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-navy">Facturado</dt>
        <dd className="text-ink">{item.invoiced ? "Sí" : "No"}</dd>
      </div>
    </dl>
  );
}

function confirmArchive() {
  return window.confirm("¿Archivar este entregable? Deja de verse en la ficha (impacto en facturación).");
}

function DeliverableRow({
  item,
  workstreamId,
  canEdit,
  canManage,
}: {
  item: DeliverableItem;
  workstreamId: string;
  canEdit: boolean;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <Card className="p-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (open) setEditing(false);
        }}
        className="flex w-full cursor-pointer items-start gap-3 text-left"
      >
        <AngleIcon direction={open ? "down" : "right"} className="mt-1 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-navy">{formatDay(item.delivery_on)}</span>
            {item.invoiced ? <MetaPill tone="ok">Facturado</MetaPill> : null}
            {item.triggers_invoice && !item.invoiced ? <MetaPill tone="warn">Dispara factura</MetaPill> : null}
            {item.triggers_invoice ? <MetaPill>{formatPercent(item.invoice_percent)}</MetaPill> : null}
            <MetaPill>{kindLabel(item.kind)}</MetaPill>
          </div>
          <p className="mt-1 text-sm text-ink">{item.description}</p>
        </div>
      </button>

      {open ? (
        <div className="mt-3 ml-6 space-y-3">
          {editing && canEdit ? (
            <form action={updateDeliverable} className="space-y-4">
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="workstream_id" value={workstreamId} />
              <DeliverableFields defaults={item} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary">
                  Guardar
                </Button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="cursor-pointer text-sm text-navy hover:text-cyan"
                >
                  Cancelar
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirmArchive()) return;
                      await archiveDeliverable(item.id, workstreamId);
                    }}
                    className="cursor-pointer text-sm text-danger hover:underline"
                  >
                    Archivar
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <>
              <DeliverableDetails item={item} />
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
                    Editar
                  </Button>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirmArchive()) return;
                        await archiveDeliverable(item.id, workstreamId);
                      }}
                      className="cursor-pointer text-sm text-danger hover:underline"
                    >
                      Archivar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function DeliverablesSummary({ items }: { items: DeliverableItem[] }) {
  if (items.length === 0) return null;

  const invoiceTriggers = items.filter((item) => item.triggers_invoice).length;
  const pendingPercent = items
    .filter((item) => item.triggers_invoice && !item.invoiced)
    .reduce((sum, item) => sum + toPercentNumber(item.invoice_percent), 0);
  const today = new Date().toISOString().slice(0, 10);
  const dated = items
    .filter((item) => item.delivery_on)
    .slice()
    .sort((a, b) => String(a.delivery_on).localeCompare(String(b.delivery_on)));
  const next = dated.find((item) => String(item.delivery_on) >= today) ?? dated[0] ?? null;

  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      <span>
        <span className="font-medium text-navy">{items.length}</span>{" "}
        {items.length === 1 ? "entregable" : "entregables"}
      </span>
      <span>
        <span className="font-medium text-navy">{invoiceTriggers}</span> disparan factura
      </span>
      <span>
        Pendiente de facturar:{" "}
        <span className="font-medium text-navy">{formatPercent(pendingPercent)}</span>
      </span>
      <span>
        Próximo:{" "}
        <span className="font-medium text-navy">
          {next ? `${formatDay(next.delivery_on)} · ${next.description}` : "Sin fecha"}
        </span>
      </span>
    </div>
  );
}

export function WorkstreamDeliverables({
  workstreamId,
  canEdit,
  canManage,
  deliverables,
}: {
  workstreamId: string;
  canEdit: boolean;
  canManage: boolean;
  deliverables: DeliverableItem[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-ink">Entregables</h2>

      <DeliverablesSummary items={deliverables} />

      {deliverables.length === 0 ? (
        <p className="mb-3 text-sm text-muted">Todavía no hay entregables en este workstream.</p>
      ) : null}

      <ul className="space-y-3">
        {deliverables.map((item) => (
          <li key={item.id}>
            <DeliverableRow
              item={item}
              workstreamId={workstreamId}
              canEdit={canEdit}
              canManage={canManage}
            />
          </li>
        ))}
      </ul>

      {canManage ? (
        <div className="mt-4">
          {adding ? (
            <Card className="p-6">
              <h3 className="mb-3 text-sm font-medium text-ink">Agregar entregable</h3>
              <form action={createDeliverable} className="space-y-4">
                <input type="hidden" name="workstream_id" value={workstreamId} />
                <DeliverableFields />
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="primary">
                    Guardar
                  </Button>
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="cursor-pointer text-sm text-navy hover:text-cyan"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </Card>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAdding(true)}
              aria-expanded={false}
            >
              Agregar entregable
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
