/** Sheet público de horas proyectadas / reales mensuales. */
export const HOURS_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmnKJkTzShH8aDFn9igDILDcazabAbZRwm41v-iAXud2XIp1wHoruuQ5vFDKpkZ3jhb4Xw-JTrzirM/pub?gid=418485053&single=true&output=csv";

/** CSV Drive con mes ≤ este se consideran ya cargados vía el Sheet. */
export const DRIVE_HISTORICAL_SYNC_THROUGH = "2026-07-01";

const MONTH_LABELS: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sept: 9,
  sep: 9,
  septiembre: 9,
  set: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

export function parseDurationToHours(value: string): number | null {
  const raw = value.trim();
  if (!raw || raw === "#REF!" || raw === "#N/A" || raw === "-") return null;
  if (/^\d+([.,]\d+)?$/.test(raw)) {
    return Number(raw.replace(",", "."));
  }
  const match = raw.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) return null;
  // Algunos valores vienen como 280:00:00 (horas:min:seg con horas grandes).
  if (match[3] !== undefined && hours >= 24) {
    return hours + minutes / 60 + seconds / 3600;
  }
  return hours + minutes / 60 + seconds / 3600;
}

export function monthStartFromLabel(label: string): string | null {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const match = normalized.match(/^([a-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTH_LABELS[match[1]];
  const year = Number(match[2]);
  if (!month || !year) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function monthStart(year: number, month: number): string | null {
  if (!year || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Interpreta a/b/yyyy ambiguo (MM/DD vs DD/MM) usando el par "to" si existe. */
function resolveAmbiguousDateParts(
  a: number,
  b: number,
  year: number,
  toA?: number,
  toB?: number,
  toYear?: number,
): string | null {
  const endDayFirst = toA !== undefined && toB !== undefined && toA > 12 && toB <= 12;
  const endMonthFirst = toA !== undefined && toB !== undefined && toB > 12 && toA <= 12;
  if (b > 12 && a <= 12) return monthStart(year, a); // MM/DD
  if (a > 12 && b <= 12) return monthStart(year, b); // DD/MM
  if (endDayFirst && toYear) return monthStart(toYear, toB!);
  if (endMonthFirst && toYear) return monthStart(toYear, toA!);
  if (toA !== undefined && toB !== undefined && toYear && toA <= 12 && toB <= 12) {
    // Mismo mes en ambos extremos → usamos ese mes (asume MM/DD o DD/MM coherente)
    if (a === toA && b === toB) return monthStart(year, a <= 12 ? a : b);
    if (a === toA) return monthStart(toYear, a);
    if (b === toB) return monthStart(toYear, b);
  }
  // Default Toggl US export: MM_DD_YYYY
  return monthStart(year, a);
}

/** Infiere mes (YYYY-MM-01) desde nombres típicos de reportes Toggl / locales. */
export function inferMonthFromFileName(fileName: string): string | null {
  const name = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const togglIso = name.match(/from[_ (](\d{4})[_-](\d{2})[_-](\d{2})/);
  if (togglIso) {
    return monthStart(Number(togglIso[1]), Number(togglIso[2]));
  }

  const rangeIso = name.match(/(\d{4})-(\d{2})-(\d{2}).{0,3}(\d{4})-(\d{2})-(\d{2})/);
  if (rangeIso) {
    return monthStart(Number(rangeIso[4]), Number(rangeIso[5]));
  }

  const togglPair = name.match(
    /from[_ (](\d{2})[_-](\d{2})[_-](\d{4}).{0,12}to[_ )-](\d{2})[_-](\d{2})[_-](\d{4})/,
  );
  if (togglPair) {
    return resolveAmbiguousDateParts(
      Number(togglPair[1]),
      Number(togglPair[2]),
      Number(togglPair[3]),
      Number(togglPair[4]),
      Number(togglPair[5]),
      Number(togglPair[6]),
    );
  }

  const togglSingle = name.match(/from[_ (](\d{2})[_-](\d{2})[_-](\d{4})/);
  if (togglSingle) {
    return resolveAmbiguousDateParts(
      Number(togglSingle[1]),
      Number(togglSingle[2]),
      Number(togglSingle[3]),
    );
  }

  for (const [label, month] of Object.entries(MONTH_LABELS)) {
    if (label.length < 3) continue;
    const re = new RegExp(`(?:^|[^a-z])${label}(?:[^a-z]|$)[^0-9]{0,8}(20\\d{2})`);
    const m = name.match(re);
    if (m) return monthStart(Number(m[1]), month);
    const re2 = new RegExp(`(20\\d{2})[^0-9]{0,8}(?:^|[^a-z])${label}(?:[^a-z]|$)`);
    const m2 = name.match(re2);
    if (m2) return monthStart(Number(m2[1]), month);
  }

  return null;
}

export function normalizeAlias(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type ParsedHoursBudget = {
  personName: string;
  personId: string;
  rawClientLabel: string;
  rawProjectLabel: string;
  estimatedHours: number;
};

export type ParsedHoursEntry = {
  personName: string;
  personId: string;
  rawClientLabel: string;
  rawProjectLabel: string;
  monthStart: string;
  hours: number;
};

export type HoursSheetParseResult = {
  budgets: ParsedHoursBudget[];
  entries: ParsedHoursEntry[];
  skippedPersonNames: string[];
  skippedPersonRows: number;
  projectCount: number;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function parseHoursSheetCsv(
  csvText: string,
  resolvePersonId: (name: string) => string | null,
): HoursSheetParseResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      budgets: [],
      entries: [],
      skippedPersonNames: [],
      skippedPersonRows: 0,
      projectCount: 0,
    };
  }

  const header = rows[0].map((h) => h.trim());
  const monthColumns: { index: number; monthStart: string }[] = [];
  for (let i = 0; i < header.length; i++) {
    const monthStart = monthStartFromLabel(header[i]);
    if (monthStart) monthColumns.push({ index: i, monthStart });
  }

  const budgets: ParsedHoursBudget[] = [];
  const entries: ParsedHoursEntry[] = [];
  const skipped = new Map<string, number>();
  let currentClient = "";
  let currentProject = "";
  let projectCount = 0;

  for (const raw of rows.slice(1)) {
    const client = (raw[0] ?? "").trim();
    const projectName = (raw[2] ?? "").trim();
    const team = (raw[3] ?? "").trim();
    const proy = (raw[4] ?? "").trim();

    if (projectName && !team) {
      currentClient = client || currentClient;
      currentProject = projectName;
      projectCount += 1;
      continue;
    }
    if (!team || !currentProject) continue;

    const personId = resolvePersonId(team);
    if (!personId) {
      skipped.set(team, (skipped.get(team) ?? 0) + 1);
      continue;
    }

    const estimated = parseDurationToHours(proy);
    if (estimated !== null && estimated > 0) {
      budgets.push({
        personName: team,
        personId,
        rawClientLabel: currentClient,
        rawProjectLabel: currentProject,
        estimatedHours: Math.round(estimated * 100) / 100,
      });
    }

    for (const col of monthColumns) {
      const hours = parseDurationToHours((raw[col.index] ?? "").trim());
      if (hours === null || hours <= 0) continue;
      entries.push({
        personName: team,
        personId,
        rawClientLabel: currentClient,
        rawProjectLabel: currentProject,
        monthStart: col.monthStart,
        hours: Math.round(hours * 100) / 100,
      });
    }
  }

  return {
    budgets: dedupeBudgets(budgets),
    entries: dedupeEntries(entries),
    skippedPersonNames: [...skipped.keys()].sort((a, b) => a.localeCompare(b, "es")),
    skippedPersonRows: [...skipped.values()].reduce((a, b) => a + b, 0),
    projectCount,
  };
}

function dedupeBudgets(budgets: ParsedHoursBudget[]) {
  const map = new Map<string, ParsedHoursBudget>();
  for (const budget of budgets) {
    const key = `${budget.personId}\0${budget.rawClientLabel}\0${budget.rawProjectLabel}`;
    map.set(key, budget);
  }
  return [...map.values()];
}

function dedupeEntries(entries: ParsedHoursEntry[]) {
  const map = new Map<string, ParsedHoursEntry>();
  for (const entry of entries) {
    const key = `${entry.personId}\0${entry.rawClientLabel}\0${entry.rawProjectLabel}\0${entry.monthStart}`;
    const prev = map.get(key);
    if (prev) {
      prev.hours = Math.round((prev.hours + entry.hours) * 100) / 100;
    } else {
      map.set(key, { ...entry });
    }
  }
  return [...map.values()];
}

export async function fetchHoursSheetCsv(url = HOURS_SHEET_CSV_URL) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo descargar el sheet de horas (${response.status}).`);
  }
  return response.text();
}
