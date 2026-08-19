const DOMAIN = "@sociopublico.com";

export function toSocioEmail(raw: string) {
  let local = raw.trim().toLowerCase();
  if (local.endsWith(DOMAIN)) local = local.slice(0, -DOMAIN.length);
  if (!local) throw new Error("El mail es obligatorio.");
  if (local.includes("@")) throw new Error("Usá solo la primera parte del mail.");
  if (!/^[a-z0-9._+-]+$/.test(local)) throw new Error("Mail inválido.");
  return `${local}${DOMAIN}`;
}

export function socioLocalPart(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(DOMAIN) ? normalized.slice(0, -DOMAIN.length) : normalized;
}
