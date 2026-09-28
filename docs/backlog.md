# Backlog conocido

Cosas que el equipo ya marcó y **no** están hechas. Si vas a agarrar una, confirmá con Agus / Kike / Ale porque varias son de producto, no solo de código.

## Producto

- La ficha de proyecto y el nomenclador (`code`) deberían vivir juntos.
- Revisar qué ve Staff vs Editor vs Admin (hoy Staff = mismo `can_write` que Editor; UI todavía no diferencia).

## Proyectos

- (Hecho) Filtros: cliente, tiene ficha sí/no, tiene alias de horas sí/no; expandir/colapsar todos removido.
- (Hecho) Datos de contrato en ficha (partner, fechas, propuesta, carpeta, duración, agenda de pagos, punto de cobro).
- (Hecho) Campo `name` (nombre del proyecto) antes de tipo en alta/edición; la UI sugiere `code` (`Cliente-Nombre` / `InternoSocio-Nombre`) y se puede editar a mano (proyectos viejos conservan el suyo).
- (Hecho) `actual_end_on` (fin real) aparte de `end_on` (fin de contrato); labels UI actualizados; al setear contrato se autocompleta el fin real.
- (Hecho) Recordatorio de retención de archivos a los 90 días de `actual_end_on` (carteles en `/editor`, `/staff`, ficha; tilde hecho/no aplica; tarea en timeline).

## Workstreams

- Entregables: schema `deliverables` listo; UI en ficha de workstream (CRUD + archivar). Falta mostrarlos en la lista de proyectos. Avisos a Kike = a futuro.
- (Hecho) Equipo: tabla persona → roles (varios roles por persona); form de alta colapsado.

## Timeline

- Marcar inicio/fin pautado del proyecto en la grilla.
- Marcar fecha de entregables.

## Horas / Toggl

- Idea: extensión o import automático desde Toggl (hoy el camino principal es Drive).
- Distinguir en qué trabajó alguien (diseño vs Strapi, etc.): hace falta un criterio/tag; preguntar a Kike.

## Notas sueltas

Hay archivos locales no versionados (`decisiones.md`, `plan-prompts.md`, CSVs del spreadsheet) que Agus usó de scratch. El backlog “oficial” de este repo es este archivo.
