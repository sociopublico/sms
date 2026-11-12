# Backlog conocido

Cosas que el equipo ya marcó. Si vas a agarrar una, confirmá con Agus / Kike / Ale porque varias son de producto, no solo de código.

## Feedback Juli + Agus (nov 2026)

Vistas que usa Juli: Timeline, Personas / Workload.

### Ya existe (no re-pedir)

- Vista mensual del Timeline (`?view=month`).
- Orden default alfabético por cliente en Timeline.
- Proyecto con 1 solo workstream: una línea, sin desplegable.
- Workload ordenado por `display_name`.
- Filtros de proyectos: ficha sí/no, alias de horas sí/no.
- Fechas de contrato del proyecto (`kickoff_on` / `end_on`) en el form.

### Timeline — hecho en este lote

- Tooltip / editor de agregar tareas: flip vertical cuando estás abajo.
- Slide de semanas más smooth (420ms).
- Toggle “Más columnas” (18 semanas / 8 meses).

### Timeline — pendiente

- Marcar inicio/fin pautado del proyecto en la grilla.
- Marcar fecha estimada de entregables.

### Workload — hecho en este lote

- Tooltip rico: Cliente → Proyecto → Workstream → tipo (si es PM / always_on_duty, mostrar el rol).
- Links a proyecto y workstream desde el tooltip.
- Investigación linkeada al rol Investigación (`task_roles` + migración).

### Navegación — hecho en este lote

- Código de proyecto clickeable en Timeline → `/proyectos/[id]`.
- Ficha workstream: título = cliente; botón “Ir al proyecto”.

### Producto abierto (no codear todavía)

- Estado de cierre de un proyecto: indicaciones de qué pasa; Ale dice cuándo terminan, no por la fecha actual. Pensarlo mejor.
- “Que la bajada sea… horas con Clientes”: sin definir aún (¿Horas? ¿Workload?).
- Quizá sacar “abrir todos / cerrar todos” del Timeline si estorba.

## Producto (previo)

- Workstream y proyecto tienen que sentirse más distintos (hoy el alta a veces los mezcla).
- La ficha de proyecto y el nomenclador (`code`) deberían vivir juntos (parcial: mismo form).
- Revisar qué ve una PM vs un admin (hoy Editor = casi todo menos usuarios/logs/conectar Drive).

## Workstreams (previo)

- Entregables con fecha estimada y fecha real; mostrarlos en la lista de proyectos.
- A futuro: avisos a Kike cuando hay entregables nuevos.
- El form de equipo (persona + rol) es incómodo: debería parecerse a una tabla, una persona con varios roles de una.

## Horas / Toggl

- Idea: extensión o import automático desde Toggl (hoy el camino principal es Drive).
- Distinguir en qué trabajó alguien (diseño vs Strapi, etc.): hace falta un criterio/tag; preguntar a Kike.

## Notas sueltas

Hay archivos locales no versionados (`decisiones.md`, `plan-prompts.md`, CSVs del spreadsheet) que Agus usó de scratch. El backlog “oficial” de este repo es este archivo.
