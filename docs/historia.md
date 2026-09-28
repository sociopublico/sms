# Historia del SMS

Resumen para quien entra ahora: qué es esto, qué se construyó, y qué lecciones ya pagamos.

## De dónde sale

Socio Público manejaba proyectos en curso en un spreadsheet (timelines, staffing, apodos). El SMS lo reemplaza: una app interna con login Google `@sociopublico.com`, timeline semanal, catálogo de personas y, más adelante, las horas que vivían en Drive / Toggl.

El seed (`supabase/seed.sql`) es un snapshot de ese spreadsheet (proyectos en curso / pausado / mantenimiento).

## Qué hay hoy (ago 2026)

1. **Auth y permisos**  
   Google OAuth. Roles: Lector / Staff / Editor / Admin. Cualquier cuenta del dominio entra como Lector. En Usuarios se invita o se cambia el permiso (solo la parte local del mail: `juli` → `julieta@sociopublico.com`). Staff escribe igual que Editor en DB; la UI se refinará.

2. **Timeline**  
   Vista principal. Proyectos colapsables, workstreams, tareas por semana. Atajos de teclado, 6 semanas en pantallas chicas, indicador si la semana actual/próxima no tiene tarea.

3. **Proyectos**  
   Lista con filtros (estado + cliente / ficha / label de horas), alta de proyecto separada del workstream, ficha con datos de contrato (partner, fechas de firma/kickoff/fin de contrato/`actual_end_on` fin real, propuesta, carpeta, pagos, SPUY/SPAR), asignaciones persona+rol, internos vs cliente.

4. **Personas / workload / tareas / roles**  
   Catálogo con apodos. Workload por semana. Soft delete / ocultar. Colores de tareas.

5. **Entregables**  
   Tabla `deliverables` por workstream (tipo producto/horas, % factura, fecha, URL, soft delete). Alta/edición/archivo en la ficha del workstream.

6. **Horas**  
   Sync desde una carpeta de Google Drive (PDFs / sheets). Aliases para matchear nombres de carpeta y de proyecto con el catálogo. Tabla editable de horas mensuales y presupuestos. Solo admin conecta Drive; editors pueden ver/editar la tabla y disparar sync si ya hay conexión.

7. **Log**  
   Cada visita y cada cambio (server action + triggers de fila) quedan en `audit_events`. Los payloads se intentan mostrar legibles (nombre de tarea, fecha de semana, no UUIDs crudos). También se registran **logins fallidos** (sin sesión).

## Commits que importan

- Timeline como home, catálogo, permisos.
- Timeline más rápido + teclado.
- Roles Lector/Staff/Editor/Admin + log de visitas y cambios. Staff entra a `/staff` (home con facturación próxima).
- Altas de proyecto unificadas, lectura sin borrar usuarios, UI más clara.
- Sync de horas desde Drive, tabla editable, menú por rol.
- Login fallido visible + logueado (Kike se loopeaba en `/login` y `/log` no mostraba nada).
- Fix del trigger `handle_new_user`: variable `email` ambigua vs columna → `Database error saving new user`. Renombrada a `v_email`. Eso destrabó altas nuevas (Kike, y las que sigan).

## Bug de login (agosto 2026) — no lo repitas

Kike (`enrique@sociopublico.com`) no podía entrar a prod. Google autenticaba bien. Auth abortaba al insertar en `auth.users` porque el trigger hacía SQL con una variable `email` del mismo nombre que `NEW.email` y `app_emails.email`.

Síntoma en la URL: `error=server_error&error_description=Database+error+saving+new+user`.  
Síntoma en Postgres: `handle_new_user failed for enrique@sociopublico.com: column reference "email" is ambiguous`.

Quienes ya tenían `auth.users` (Agus, Ale, Juli, Mer, Sonia…) seguían entrando: el trigger solo corre en el **primer** insert.

Lecciones:

- No nombres variables igual que columnas en triggers de `auth.users`.
- Un trigger que escribe `audit_events` no puede tirar para atrás el signup.
- `/log` no ve fallos pre-sesión salvo que existan `log_auth_event` y la UI de login los mande.
- `hd=sociopublico.com` es un hint de Google, no un lock. Hay que validar el dominio en el trigger.

## Dónde vive cada cosa

| Cosa | Dónde |
| --- | --- |
| App prod | Vercel, `sms-sociopublico.vercel.app` |
| DB / Auth prod | Supabase **Sociopublico Management System** |
| Schema | `supabase/migrations/` |
| Seed | `supabase/seed.sql` |
| Drive (carpeta de horas) | ID en `lib/drive-constants.ts` |

Push a `main` deploya la app. El SQL hay que pushearlo aparte (`npx supabase db push --linked`).
