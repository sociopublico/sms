import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AuditPayload = Record<string, unknown>;

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function formPayload(formData: FormData): AuditPayload {
  const out: AuditPayload = {};
  for (const key of new Set(formData.keys())) {
    const all = formData.getAll(key).map(String);
    out[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}

export async function logAuditEvent(input: {
  action: string;
  path?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  payload?: AuditPayload;
  ok?: boolean;
  error?: string | null;
}) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("log_audit", {
      p_action: input.action,
      p_path: input.path ?? null,
      p_resource_type: input.resourceType ?? null,
      p_resource_id: input.resourceId ?? null,
      p_payload: input.payload ?? {},
      p_ok: input.ok ?? true,
      p_error: input.error ?? null,
    });
    if (error) console.error("audit log failed", error.message);
  } catch (error) {
    console.error("audit log failed", error);
  }
}

export async function requestPath() {
  try {
    const h = await headers();
    return h.get("x-pathname") ?? h.get("next-url") ?? h.get("referer");
  } catch {
    return null;
  }
}

export async function withAudit<T>(
  action: string,
  fn: () => Promise<T>,
  payload: AuditPayload = {},
  resource?: { type?: string; id?: string },
): Promise<T> {
  await requireSession();
  const path = await requestPath();
  try {
    const result = await fn();
    await logAuditEvent({
      action,
      path,
      resourceType: resource?.type,
      resourceId: resource?.id,
      payload,
      ok: true,
    });
    return result;
  } catch (error) {
    if (isNextRedirect(error)) {
      await logAuditEvent({
        action,
        path,
        resourceType: resource?.type,
        resourceId: resource?.id,
        payload,
        ok: true,
      });
      throw error;
    }
    const message = error instanceof Error ? error.message : "Error desconocido";
    await logAuditEvent({
      action,
      path,
      resourceType: resource?.type,
      resourceId: resource?.id,
      payload,
      ok: false,
      error: message,
    });
    throw error;
  }
}

export async function logPageView(path: string) {
  const session = await requireSession();
  if (!path || !session) return;
  await logAuditEvent({
    action: "page.view",
    path,
    payload: { email: session.email, role: session.appRole },
  });
}
