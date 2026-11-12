export function mondayOf(date: Date): Date {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy;
}

export function addWeeks(date: Date, weeks: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + weeks * 7);
  return copy;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatWeekLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatMonthLabel(monthId: string): string {
  const [year, month] = monthId.split("-").map(Number);
  return `${MONTH_SHORT[month - 1] ?? ""} ${String(year).slice(2)}`;
}

export function mondaysOfMonth(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  let cursor = mondayOf(first);
  if (cursor.getUTCFullYear() !== year || cursor.getUTCMonth() !== month - 1) cursor = addWeeks(cursor, 1);
  const out: string[] = [];
  while (cursor.getUTCFullYear() === year && cursor.getUTCMonth() === month - 1) {
    out.push(toISODate(cursor));
    cursor = addWeeks(cursor, 1);
  }
  return out;
}

export function fullMonthIds(weeks: string[]): string[] {
  const have = new Set(weeks);
  const ids: string[] = [];
  for (const week of weeks) {
    const id = week.slice(0, 7);
    if (ids[ids.length - 1] === id) continue;
    const [year, month] = id.split("-").map(Number);
    const mondays = mondaysOfMonth(year, month);
    if (mondays.length > 0 && mondays.every((day) => have.has(day))) ids.push(id);
  }
  return ids;
}

export const TIMELINE_VISIBLE_WEEKS = 12;
export const TIMELINE_WEEK_BUFFER = 24;

export function weekRange(startIso: string, count: number): string[] {
  const start = new Date(`${startIso}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => toISODate(addWeeks(start, i)));
}

export const STATUS_LABEL: Record<string, string> = {
  en_curso: "En curso",
  pausado: "Pausado",
  mantenimiento: "Mantenimiento",
  finalizado: "Finalizado",
};

export const STATUS_OPTIONS = ["en_curso", "pausado", "mantenimiento", "finalizado"] as const;

export function isCurrentMonth(iso: string, now = new Date()): boolean {
  const [year, month] = iso.split("-").map(Number);
  return year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;
}
