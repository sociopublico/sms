import { DRIVE_ROOT_FOLDER_ID, type DriveFile } from "@/lib/drive-constants";

export {
  DRIVE_ROOT_FOLDER_ID,
  DRIVE_OAUTH_SCOPES,
  DRIVE_CONNECT_NEXT,
  type DriveFile,
} from "@/lib/drive-constants";

function googleClientId() {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("Falta GOOGLE_CLIENT_ID en el entorno de Next.js.");
  return id;
}

function googleClientSecret() {
  const secret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET;
  if (!secret) {
    throw new Error("Falta GOOGLE_CLIENT_SECRET (o SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET) en Next.js.");
  }
  return secret;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "No se pudo renovar el token de Google.");
  }
  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000),
  };
}

export async function listDriveChildren(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType)");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("orderBy", "folder,name");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = (await response.json()) as {
      files?: DriveFile[];
      nextPageToken?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(payload.error?.message || "No se pudo listar la carpeta de Drive.");
    }
    files.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return files;
}

export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const SHEETS_MIME = "application/vnd.google-apps.spreadsheet";

export function isCsvLikeFile(file: DriveFile) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".csv") ||
    file.mimeType === "text/csv" ||
    file.mimeType === "application/csv" ||
    file.mimeType === "text/plain" && name.includes("hora")
  );
}

export function isHoursCandidate(file: DriveFile) {
  return isCsvLikeFile(file) || file.mimeType === SHEETS_MIME;
}

export async function downloadDriveFileText(accessToken: string, file: DriveFile) {
  if (file.mimeType === SHEETS_MIME) {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${file.id}/export`);
    url.searchParams.set("mimeType", "text/csv");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message || `No se pudo exportar ${file.name}`);
    }
    return response.text();
  }

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${file.id}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || `No se pudo descargar ${file.name}`);
  }
  return response.text();
}

/** Parse first line(s) of CSV into headers + sample row count estimate. */
export function sniffCsv(text: string) {
  const sample = text.replace(/^\uFEFF/, "").slice(0, 50_000);
  const lines = sample.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [] as string[], delimiter: ",", rowCountSample: 0, previewRows: [] as string[][] };

  const delimiter = guessDelimiter(lines[0]);
  const rows = lines.slice(0, 6).map((line) => splitCsvLine(line, delimiter));
  const headers = rows[0]?.map((cell) => cell.trim()) ?? [];
  return {
    headers,
    delimiter,
    rowCountSample: Math.max(0, lines.length - 1),
    previewRows: rows.slice(1, 4),
  };
}

function guessDelimiter(headerLine: string) {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function formatSignature(headers: string[]) {
  return headers.map((h) => h.trim().toLowerCase()).filter(Boolean).join(" | ");
}
