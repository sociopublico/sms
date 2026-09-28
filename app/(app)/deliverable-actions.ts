"use server";

import { revalidatePath } from "next/cache";
import { canManageDelivery, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formPayload, withAudit } from "@/lib/audit";
import { parseOptionalHttpUrl } from "@/lib/urls";

async function assertWrite() {
  const session = await requireSession();
  if (!session.canWrite) throw new Error("No tenés permiso para editar.");
  return { supabase: await createClient(), session };
}

async function assertDeliveryManager() {
  const { supabase, session } = await assertWrite();
  if (!canManageDelivery(session.appRole)) {
    throw new Error("No tenés permiso para esta acción.");
  }
  return supabase;
}

function parseDeliverableKind(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "product" && kind !== "hours") throw new Error("El tipo de entregable es obligatorio.");
  return kind;
}

function parseOptionalDate(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function parseCheckbox(formData: FormData, name: string) {
  return formData.get(name) === "true";
}

function parseInvoicePercent(formData: FormData) {
  const raw = String(formData.get("invoice_percent") ?? "").trim();
  if (!raw) return 0;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) throw new Error("El porcentaje de facturación es inválido.");
  return value;
}

function parseSortOrder(formData: FormData) {
  const raw = String(formData.get("sort_order") ?? "").trim();
  if (!raw) return 0;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) throw new Error("El orden es inválido.");
  return value;
}

function revalidateDeliverablePaths(workstreamId: string) {
  revalidatePath(`/workstreams/${workstreamId}`);
  revalidatePath("/proyectos");
  revalidatePath("/timeline");
  revalidatePath("/staff");
}

export async function createDeliverable(formData: FormData) {
  return withAudit(
    "deliverables.create",
    async () => {
      const supabase = await assertDeliveryManager();
      const workstreamId = String(formData.get("workstream_id") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      if (!workstreamId) throw new Error("El workstream es obligatorio.");
      if (!description) throw new Error("La descripción es obligatoria.");

      const { data: last } = await supabase
        .from("deliverables")
        .select("sort_order")
        .eq("workstream_id", workstreamId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase.from("deliverables").insert({
        workstream_id: workstreamId,
        kind: parseDeliverableKind(formData),
        description,
        triggers_invoice: parseCheckbox(formData, "triggers_invoice"),
        invoice_percent: parseInvoicePercent(formData),
        delivery_on: parseOptionalDate(formData, "delivery_on"),
        url: parseOptionalHttpUrl(String(formData.get("url") ?? ""), "El link del entregable"),
        invoiced: parseCheckbox(formData, "invoiced"),
        sort_order: (last?.sort_order ?? -1) + 1,
      });
      if (error) throw new Error(error.message);
      revalidateDeliverablePaths(workstreamId);
    },
    formPayload(formData),
    { type: "workstream", id: String(formData.get("workstream_id") ?? "") || undefined },
  );
}

export async function updateDeliverable(formData: FormData) {
  return withAudit(
    "deliverables.update",
    async () => {
      const { supabase } = await assertWrite();
      const id = String(formData.get("id") ?? "").trim();
      const workstreamId = String(formData.get("workstream_id") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      if (!id || !workstreamId) throw new Error("El entregable es obligatorio.");
      if (!description) throw new Error("La descripción es obligatoria.");

      const patch: Record<string, unknown> = {
        kind: parseDeliverableKind(formData),
        description,
        triggers_invoice: parseCheckbox(formData, "triggers_invoice"),
        invoice_percent: parseInvoicePercent(formData),
        delivery_on: parseOptionalDate(formData, "delivery_on"),
        url: parseOptionalHttpUrl(String(formData.get("url") ?? ""), "El link del entregable"),
        invoiced: parseCheckbox(formData, "invoiced"),
      };
      if (formData.has("sort_order")) {
        patch.sort_order = parseSortOrder(formData);
      }

      const { error } = await supabase
        .from("deliverables")
        .update(patch)
        .eq("id", id)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      revalidateDeliverablePaths(workstreamId);
    },
    formPayload(formData),
    { type: "deliverable", id: String(formData.get("id") ?? "") },
  );
}

export async function archiveDeliverable(deliverableId: string, workstreamId: string) {
  return withAudit(
    "deliverables.archive",
    async () => {
      const supabase = await assertDeliveryManager();
      const { error } = await supabase
        .from("deliverables")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deliverableId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      revalidateDeliverablePaths(workstreamId);
    },
    { deliverableId, workstreamId },
    { type: "deliverable", id: deliverableId },
  );
}

export async function setDeliverableInvoiced(
  deliverableId: string,
  workstreamId: string,
  invoiced: boolean,
) {
  return withAudit(
    "deliverables.set_invoiced",
    async () => {
      const { supabase } = await assertWrite();
      if (!deliverableId || !workstreamId) throw new Error("El entregable es obligatorio.");
      const { error } = await supabase
        .from("deliverables")
        .update({ invoiced })
        .eq("id", deliverableId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      revalidateDeliverablePaths(workstreamId);
    },
    { deliverableId, workstreamId, invoiced },
    { type: "deliverable", id: deliverableId },
  );
}
