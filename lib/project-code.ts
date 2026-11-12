/** Prefijo de ID de contrato para proyectos internos. */
export const INTERNAL_PROJECT_CODE_PREFIX = "InternoSocio";

/** Espacios en un segmento (cliente o nombre) → guiones medios (colapsa whitespace). */
export function formatCodeSegment(value: string) {
  return value.trim().replace(/\s+/g, "-");
}

/** `YYYY-MM-DD` (o ISO) → `yyyy-mm` para el sufijo del ID. */
export function contractSignedMonth(isoDate: string | null | undefined) {
  if (!isoDate) return "";
  const month = isoDate.trim().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(month) ? month : "";
}

/**
 * ID de contrato:
 * - Cliente: `{nombreCliente}_{Nombre-del-proyecto}_{yyyy-mm}`
 * - Interno: `InternoSocio_{Nombre-del-proyecto}_{yyyy-mm}`
 *
 * Espacios dentro de cliente/nombre → `-`. Separadores entre partes → `_`.
 * El sufijo `yyyy-mm` sale de la fecha de firma. Sin fecha, solo la base.
 */
export function buildProjectCode(
  kind: "client" | "internal",
  projectName: string,
  clientName?: string | null,
  contractSignedOn?: string | null,
) {
  const namePart = formatCodeSegment(projectName);
  if (!namePart) return "";

  let base: string;
  if (kind === "internal") {
    base = `${INTERNAL_PROJECT_CODE_PREFIX}_${namePart}`;
  } else {
    const clientPart = formatCodeSegment(clientName ?? "");
    if (!clientPart) return "";
    base = `${clientPart}_${namePart}`;
  }

  const month = contractSignedMonth(contractSignedOn);
  return month ? `${base}_${month}` : base;
}
