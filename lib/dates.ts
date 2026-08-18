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
