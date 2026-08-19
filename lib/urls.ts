export function parseOptionalHttpUrl(raw: string, fieldLabel = "URL"): string | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${fieldLabel} no es válida.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${fieldLabel} debe empezar con http:// o https://.`);
  }
  return url.toString();
}
