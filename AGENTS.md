<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Socio Management System

App interna de Socio Público (staffing, timeline, horas). UI y copy en **español**. Respuestas al equipo también en español.

Producción: `https://sms-sociopublico.vercel.app`  
Repo: `sociopublico/sms`  
Supabase prod: proyecto **Sociopublico Management System** (ref `wcblurhmsiicxtcmzwkn`)

Antes de codear, leé `README.md`. Historia y backlog: `docs/historia.md`, `docs/backlog.md`.

## Stack (no improvisar)

- Next.js **16** App Router + React 19. `cookies()`, `headers()`, `params` y `searchParams` son **async**.
- El request interceptor se llama `proxy.ts` (`export function proxy`), no `middleware.ts`.
- Supabase: Postgres + Auth (Google). Cliente SSR en `lib/supabase/{server,client,proxy}.ts`.
- Tailwind 4. Componentes propios en `components/ui/`. No hay shadcn.
- No hay `service_role` en la app. Mutaciones van por el user session + RLS o RPC `SECURITY DEFINER` en `private`.

## Dominio

- **Cliente** → **proyecto** (`code` único, ficha URL, kind client/internal) → **workstream** (fechas derivadas de semanas con tareas).
- **Persona** (`people.display_name`, apodos) ≠ **usuario logueado** (`profiles` + `auth.users`). Link opcional `profiles.person_id`.
- **Asignación**: persona + rol en un workstream.
- **Timeline**: `timeline_weeks` (lunes) + `timeline_week_tasks`.
- **Horas**: `time_entries` mensuales, labels crudos de Drive, aliases (`project_aliases`, `drive_person_aliases`, `person_name_aliases`) para matchear al catálogo.
- Soft delete: `deleted_at` / `hidden` en personas, roles, tareas. No borres filas de catálogo a lo loco.

Roles de app (`profiles.app_role`):

| DB | UI | Puede |
| --- | --- | --- |
| `admin` | Admin | todo, usuarios, logs, conectar Drive |
| `pm` | Editor | escribir datos |
| `member` | Lector | leer. Default para `@sociopublico.com` |

Helpers: `requireSession`, `requireWriter`, `requireAdmin` en `lib/auth.ts`. Nav en `components/AppShell.tsx`.

## Auth (zona delicada)

Login Google, solo `*@sociopublico.com`. Trigger `private.handle_new_user` en `AFTER INSERT ON auth.users` crea `profiles` + `app_emails`.

**Nunca** declares variables PL/pgSQL que se llamen igual que columnas de `NEW` o de las tablas que tocás (`email` rompió el primer login de usuarios nuevos: `column reference "email" is ambiguous` → Auth dice `Database error saving new user`). Usá `v_email`, `v_role`, etc.

El trigger de auditoría `private.audit_row` **no puede abortar** el alta de un usuario (ya tiene `EXCEPTION` y re-raise warning).

Logins fallidos: la página `/login` lee query+hash y llama `log_auth_event`. El callback `/auth/callback` loguea en Vercel. No asumas que `/log` ve intentos sin sesión si no pasó por eso.

Abrir la app en `http://localhost:3000`, no mezclar con `127.0.0.1:3000`.

## Cómo cambiar la base

1. `npx supabase migration new nombre_en_snake_case` (no inventes el filename).
2. SQL en ese archivo. Iterá con `npx supabase db query --linked` o local, no con `apply_migration` a lo loco.
3. Prod: `npx supabase db push --linked --yes` (hace falta proyecto linkeado). Vercel **no** aplica SQL.
4. RLS en todo `public`. Funciones privilegiadas en schema `private`, `SECURITY DEFINER`, `SET search_path`.
5. GRANTs explícitos a `authenticated` / `service_role`. Tablas nuevas no se auto-exponen.

## Cómo cambiar la app

- Páginas en `app/(app)/…`. Mutaciones en `*-actions.ts` (`"use server"`).
- Toda escritura pasa por `withAudit(...)` (`lib/audit.ts`) con un `action` estable tipo `projects.update`.
- Server Components por defecto. `"use client"` solo si hay estado/eventos.
- `revalidatePath` después de mutar.
- Copy en español. Permisos: no muestres edición a lectores; `canWrite` / `isAdmin` ya cortan el nav.
- No agregues librerías si se puede con lo que hay.

## UI

Tokens en Tailwind del proyecto (`canvas`, `paper`, `ink`, `muted`, `line`, `cyan`, `navy`, `danger`). Reusá `PageHeader`, `Card`, `Field`, `Button`, `FilterChips`. Tablas simples, no un design system paralelo.

## Qué no commitear

`.env.local`, secrets, CSVs de spreadsheets, notas sueltas (`decisiones.md`, `plan-prompts.md`) salvo que pidan explícitamente dejarlas en el repo.

No hagas `git push --force` a `main`. No cambies `git config`. No commitees si no lo pidieron.
