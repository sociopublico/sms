/** Prefijo de ID de contrato para proyectos internos. */
export const INTERNAL_PROJECT_CODE_PREFIX = "InternoSocio";

/** Espacios del nombre → guiones bajos (colapsa corridas de whitespace). */
export function formatProjectNameForCode(projectName: string) {
  return projectName.trim().replace(/\s+/g, "_");
}

/**
 * ID de contrato:
 * - Cliente: `{nombreCliente}-{Nombre_del_proyecto}`
 * - Interno: `InternoSocio-{Nombre_del_proyecto}`
 */
export function buildProjectCode(
  kind: "client" | "internal",
  projectName: string,
  clientName?: string | null,
) {
  const namePart = formatProjectNameForCode(projectName);
  if (!namePart) return "";

  if (kind === "internal") {
    return `${INTERNAL_PROJECT_CODE_PREFIX}-${namePart}`;
  }

  const clientPart = (clientName ?? "").trim();
  if (!clientPart) return "";
  return `${clientPart}-${namePart}`;
}
