import { normalizeAlias, parseCsv, parseDurationToHours } from "@/lib/hours-sheet";

export type TogglMonthlyAggregate = {
  rawClientLabel: string;
  rawProjectLabel: string;
  monthStart: string;
  hours: number;
};

export type TogglParseResult = {
  aggregates: TogglMonthlyAggregate[];
  rowCount: number;
  skippedRows: number;
  warning?: string;
};

function headerIndex(headers: string[], candidates: string[]) {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  return -1;
}

function monthStartFromDateValue(value: string, fallbackMonth: string | null): string | null {
  const raw = value.trim();
  if (!raw) return fallbackMonth;
  // ISO / Toggl: 2026-01-15 or 2026-01-15T10:00:00
  const iso = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (iso) return `${iso[1]}-${iso[2]}-01`;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month > 12 && day <= 12) return `${year}-${String(day).padStart(2, "0")}-01`;
    if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, "0")}-01`;
  }
  // MM/DD/YYYY when day > 12 in second position already handled; if ambiguous use fallback
  return fallbackMonth;
}

/** Agrega filas Detailed de Toggl (project + duration + fecha) a horas mensuales. */
export function parseTogglDetailedToMonthly(
  csvText: string,
  fallbackMonth: string | null,
): TogglParseResult {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    return { aggregates: [], rowCount: 0, skippedRows: 0, warning: "CSV vacío" };
  }

  const headers = rows[0].map((h) => h.trim());
  const projectIdx = headerIndex(headers, ["project", "proyecto"]);
  const durationIdx = headerIndex(headers, ["duration", "duración", "duracion"]);
  const clientIdx = headerIndex(headers, ["client", "cliente"]);
  const dateIdx = headerIndex(headers, [
    "start date",
    "start",
    "time date",
    "date",
    "fecha",
    "start time",
  ]);

  if (projectIdx < 0 || durationIdx < 0) {
    return {
      aggregates: [],
      rowCount: 0,
      skippedRows: rows.length - 1,
      warning: "No es un Detailed usable (faltan columnas project/duration).",
    };
  }

  const map = new Map<string, TogglMonthlyAggregate>();
  let skippedRows = 0;

  for (const row of rows.slice(1)) {
    const project = (row[projectIdx] ?? "").trim();
    const hours = parseDurationToHours((row[durationIdx] ?? "").trim());
    if (!project || hours === null || hours <= 0) {
      skippedRows += 1;
      continue;
    }
    const dateRaw = dateIdx >= 0 ? (row[dateIdx] ?? "") : "";
    const monthStart = monthStartFromDateValue(dateRaw, fallbackMonth);
    if (!monthStart) {
      skippedRows += 1;
      continue;
    }
    const client = clientIdx >= 0 ? (row[clientIdx] ?? "").trim() : "";
    const key = `${client}\0${project}\0${monthStart}`;
    const prev = map.get(key);
    if (prev) {
      prev.hours = Math.round((prev.hours + hours) * 100) / 100;
    } else {
      map.set(key, {
        rawClientLabel: client,
        rawProjectLabel: project,
        monthStart,
        hours: Math.round(hours * 100) / 100,
      });
    }
  }

  return {
    aggregates: [...map.values()],
    rowCount: rows.length - 1,
    skippedRows,
  };
}

export function formatHoursClock(hours: number): string {
  if (!Number.isFinite(hours) || hours === 0) return "";
  const sign = hours < 0 ? "-" : "";
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  if (m === 60) return `${sign}${h + 1}:00`;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

export function monthLabelEs(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  const labels = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sept",
    "oct",
    "nov",
    "dic",
  ];
  return `${labels[(m ?? 1) - 1]} ${y}`;
}

export function projectAliasKey(rawClientLabel: string, rawProjectLabel: string) {
  return normalizeAlias(`${rawClientLabel} ${rawProjectLabel}`.trim() || rawProjectLabel);
}
