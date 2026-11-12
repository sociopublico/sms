"use client";

import Link from "next/link";
import { useTransition } from "react";
import { setDeliverableInvoiced } from "@/app/(app)/deliverable-actions";

export type StaffDeliverableItem = {
  id: string;
  description: string;
  invoice_percent: number | string;
  delivery_on: string | null;
  url: string | null;
  invoiced: boolean;
  workstreamId: string;
  workstreamName: string;
  projectCode: string;
};

function formatDay(iso: string | null | undefined) {
  if (!iso) return "Sin fecha";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function formatPercent(value: number | string) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `${num} %`;
}

const checkboxClass = "h-4 w-4 rounded border-line text-cyan accent-cyan";

export function StaffDeliverableRow({
  item,
  showInvoicedToggle = true,
}: {
  item: StaffDeliverableItem;
  showInvoicedToggle?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-xl border border-line bg-paper px-4 py-3 transition-colors hover:border-cyan/40 hover:bg-canvas">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/workstreams/${item.workstreamId}`} className="block">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm font-medium text-navy">{item.projectCode}</span>
              <span className="text-sm text-muted">·</span>
              <span className="text-sm text-muted">{item.workstreamName}</span>
            </div>
            <p className="mt-1 text-sm text-ink">{item.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span>{formatDay(item.delivery_on)}</span>
              <span>{formatPercent(item.invoice_percent)}</span>
            </div>
          </Link>
          {item.url ? (
            <p className="mt-2 text-xs">
              <a href={item.url} target="_blank" rel="noreferrer" className="text-cyan hover:underline">
                Abrir entregable
              </a>
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">Sin link</p>
          )}
        </div>

        {showInvoicedToggle ? (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-0.5 text-sm text-navy">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={item.invoiced}
              disabled={pending}
              onChange={(event) => {
                const next = event.target.checked;
                startTransition(async () => {
                  await setDeliverableInvoiced(item.id, item.workstreamId, next);
                });
              }}
            />
            <span className="font-medium">Facturado</span>
          </label>
        ) : item.invoiced ? (
          <span className="shrink-0 pt-0.5 text-xs font-medium text-ink">Facturado</span>
        ) : null}
      </div>
    </li>
  );
}
