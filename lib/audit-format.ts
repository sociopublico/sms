const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIELD_LABEL: Record<string, string> = {
  tarea: "Tarea",
  semana: "Semana",
  workstream: "Workstream",
  proyecto: "Proyecto",
  persona: "Persona",
  rol: "Rol",
  cliente: "Cliente",
  nombre: "Nombre",
  id: "ID",
  code: "ID",
  estado: "Estado",
  status: "Estado",
  tipo: "Tipo",
  kind: "Tipo",
  ficha: "Ficha",
  ficha_url: "Ficha",
  permiso: "Permiso",
  app_role: "Permiso",
  mail: "Mail",
  email: "Mail",
  oculto: "Oculto",
  hidden: "Oculto",
  color: "Color",
  inicio: "Inicio",
  start_on: "Inicio",
  fin: "Fin",
  end_on: "Fin",
  week_start: "Semana",
  local_part: "Mail",
  role: "Permiso",
  workstream_name: "Workstream",
  existing_project_id: "Proyecto",
  path: "Ruta",
};

const SKIP_KEYS = new Set([
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "created_by",
  "ok",
]);

export type AuditLookups = {
  tasks: Record<string, string>;
  people: Record<string, string>;
  roles: Record<string, string>;
  clients: Record<string, string>;
  projects: Record<string, string>;
  workstreams: Record<string, string>;
  weeks: Record<string, { start: string; workstream?: string; project?: string }>;
};

export type AuditField = { label: string; value: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatDay(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function fieldLabel(key: string) {
  return FIELD_LABEL[key] ?? key.replaceAll("_", " ");
}

function roleValue(raw: string) {
  if (raw === "admin") return "Admin";
  if (raw === "pm") return "Editor";
  if (raw === "member") return "Lector";
  return raw;
}

export function collectAuditIds(payloads: unknown[]) {
  const tasks = new Set<string>();
  const people = new Set<string>();
  const roles = new Set<string>();
  const clients = new Set<string>();
  const projects = new Set<string>();
  const workstreams = new Set<string>();
  const weeks = new Set<string>();

  function walk(value: unknown) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, nested] of Object.entries(value)) {
      if (key === "taskIds" && Array.isArray(nested)) {
        for (const item of nested) {
          const id = asText(item);
          if (id && UUID.test(id)) tasks.add(id);
        }
        continue;
      }
      const text = asText(nested);
      if (text && UUID.test(text)) {
        if (key === "task_id") tasks.add(text);
        else if (key === "person_id") people.add(text);
        else if (key === "role_id") roles.add(text);
        else if (key === "client_id") clients.add(text);
        else if (key === "project_id" || key === "existing_project_id") projects.add(text);
        else if (key === "workstream_id" || key === "workstreamId") workstreams.add(text);
        else if (key === "timeline_week_id") weeks.add(text);
      }
      walk(nested);
    }
  }

  for (const payload of payloads) walk(payload);
  return { tasks, people, roles, clients, projects, workstreams, weeks };
}

function humanizeRecord(record: Record<string, unknown>, lookups: AuditLookups): AuditField[] {
  const fields: AuditField[] = [];
  const seen = new Set<string>();

  function add(label: string, value: string | null | undefined) {
    if (!value || seen.has(label)) return;
    seen.add(label);
    fields.push({ label, value });
  }

  for (const [key, raw] of Object.entries(record)) {
    if (key === "taskIds" && Array.isArray(raw)) {
      const names = raw
        .map((item) => lookups.tasks[asText(item) ?? ""] ?? null)
        .filter((name): name is string => Boolean(name));
      if (names.length) add("Tareas", names.join(", "));
      continue;
    }
    if (key === "workstreamId") {
      add("Workstream", lookups.workstreams[asText(raw) ?? ""] ?? null);
      continue;
    }
    if (key === "weekStart") {
      const day = asText(raw);
      if (day) add("Semana", formatDay(day));
      continue;
    }
    if (SKIP_KEYS.has(key) || key.endsWith("_id")) {
      const text = asText(raw);
      if (key === "task_id" && text) add("Tarea", lookups.tasks[text] ?? null);
      else if (key === "person_id" && text) add("Persona", lookups.people[text] ?? null);
      else if (key === "role_id" && text) add("Rol", lookups.roles[text] ?? null);
      else if (key === "client_id" && text) add("Cliente", lookups.clients[text] ?? null);
      else if ((key === "project_id" || key === "existing_project_id") && text) {
        add("Proyecto", lookups.projects[text] ?? null);
      } else if (key === "workstream_id" && text) add("Workstream", lookups.workstreams[text] ?? null);
      else if (key === "timeline_week_id" && text) {
        const week = lookups.weeks[text];
        if (week) {
          add("Semana", formatDay(week.start));
          add("Workstream", week.workstream);
          add("Proyecto", week.project);
        }
      }
      continue;
    }

    const text = asText(raw);
    if (!text || UUID.test(text)) continue;
    if (key === "app_role" || key === "role") add("Permiso", roleValue(text));
    else if (key === "week_start" || key === "start_on" || key === "end_on") add(fieldLabel(key), formatDay(text));
    else if (key === "local_part") add("Mail", `${text}@sociopublico.com`);
    else add(fieldLabel(key), text);
  }

  return fields;
}

export function formatAuditPayload(payload: unknown, lookups: AuditLookups): AuditField[] {
  if (!isRecord(payload)) return [];
  const hasOld = "old" in payload;
  const hasNew = "new" in payload;
  if (hasOld || hasNew) {
    const before = isRecord(payload.old) ? humanizeRecord(payload.old, lookups) : [];
    const after = isRecord(payload.new) ? humanizeRecord(payload.new, lookups) : [];
    if (before.length && after.length) {
      const beforeMap = new Map(before.map((field) => [field.label, field.value]));
      const labels = new Set([...before.map((field) => field.label), ...after.map((field) => field.label)]);
      const diff: AuditField[] = [];
      for (const label of labels) {
        const prev = beforeMap.get(label);
        const next = after.find((field) => field.label === label)?.value;
        if (prev && next && prev !== next) diff.push({ label, value: `${prev} → ${next}` });
        else if (next && !prev) diff.push({ label, value: next });
        else if (prev && !next) diff.push({ label, value: `se quitó ${prev}` });
      }
      return diff.length ? diff : after;
    }
    return after.length ? after : before;
  }
  return humanizeRecord(payload, lookups);
}

export function formatLogWhen(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
}
