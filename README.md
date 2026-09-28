# Socio Management System (SMS)

App interna de Socio Público para staffing, timelines y horas del equipo. Reemplaza el spreadsheet de proyectos en curso.

Producción: [sms-sociopublico.vercel.app](https://sms-sociopublico.vercel.app)  
Repo: [github.com/sociopublico/sms](https://github.com/sociopublico/sms)

Si recién llegás, leé este README y después [docs/historia.md](docs/historia.md). El backlog abierto está en [docs/backlog.md](docs/backlog.md).

## Qué hay adentro

| Área | Para qué |
| --- | --- |
| **Timeline** | Vista principal: proyectos → workstreams → tareas por semana |
| **Proyectos** | Clientes, proyectos, workstreams, equipo asignado |
| **Personas** | Catálogo de gente, roles, tareas, workload |
| **Horas** | Tabla mensual + sync desde Google Drive (PDFs / sheets de horas) |
| **Admin** | Usuarios (Lector / Staff / Editor / Admin) y log de cambios |

Roles de la app:

- **Admin** (`admin`): todo, incluyendo usuarios, logs y conectar Drive.
- **Editor** (`pm`): escribe datos (proyectos, timeline, horas). No administra usuarios.
- **Staff** (`staff`): mismo poder de escritura en DB que Editor; la UI se irá acotando (proyectos / facturación).
- **Lector** (`member`): solo lectura. Cualquier `@sociopublico.com` entra así por defecto.

`people` es el catálogo de staffing (apodos: Juli, Kike, Agus…). `profiles` es la cuenta que se loguea. No son lo mismo: alguien puede estar en el catálogo sin haber entrado nunca.

## Día 1: levantar el proyecto

Hace falta **Node 20+**, **Docker** (para Supabase local) y una cuenta Google `@sociopublico.com`.

Pedile a Agus:

1. Acceso al repo `sociopublico/sms`.
2. `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` del OAuth de Google (el mismo par que usa local/prod).
3. Que te sume como Editor o Admin en [Usuarios](https://sms-sociopublico.vercel.app/usuarios) si todavía no podés escribir.

### 1. Clonar e instalar

```bash
git clone git@github.com:sociopublico/sms.git
cd sms   # o el nombre de carpeta local; el repo se llama gestion internamente
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

En `.env.local` poné los secrets de Google. Las keys de Supabase las copiás en el paso siguiente.

```bash
export GOOGLE_CLIENT_ID="..."
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET="..."   # mismo valor que GOOGLE_CLIENT_SECRET
```

Esas dos variables de entorno tienen que estar en la **misma terminal** donde corras `npx supabase start`. Auth local las lee de `supabase/config.toml` como `env(...)`.

### 3. Base local

```bash
npx supabase start
npx supabase status
```

De `supabase status` copiá a `.env.local`:

- `API URL` → `NEXT_PUBLIC_SUPABASE_URL` (suele ser `http://127.0.0.1:54321`)
- `Publishable key` (o `anon key`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Studio local: [http://127.0.0.1:54323](http://127.0.0.1:54323)

El seed carga catálogos y workstreams desde el snapshot del spreadsheet.

### 4. App

```bash
npm run dev
```

Abrí **siempre** [http://localhost:3000](http://localhost:3000). No mezcles `localhost` con `127.0.0.1`: las cookies de sesión no se comparten entre esos hosts.

Login: Google `@sociopublico.com`. Si Google te ofrece una Gmail personal, cambiá de cuenta (`prompt=select_account`).

## Google OAuth (si el login local falla)

El client de Google tiene que tener:

- Redirect de Auth local: `http://127.0.0.1:54321/auth/v1/callback`
- Redirect de prod: el callback de Auth del proyecto Supabase (no el de Vercel)
- Scope extra: `https://www.googleapis.com/auth/drive.readonly`

Si tocaste `site_url` o redirects en `supabase/config.toml`, reiniciá Auth:

```bash
npx supabase stop && npx supabase start
```

`GOOGLE_CLIENT_SECRET` en Next sirve para renovar el access token de Drive en el server. El login en sí lo hace Supabase Auth con `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` (tiene que ser el mismo secret).

## Comandos que vas a usar

```bash
npm run dev          # app en :3000
npm run lint
npm run build

npx supabase start
npx supabase stop
npx supabase status
npx supabase migration new nombre_en_snake_case
npx supabase db push --linked --yes    # aplicar migraciones al remoto (prod)
npx supabase db query --linked "SELECT ..."
```

Migraciones: **siempre** `npx supabase migration new …` para crear el archivo. No inventes el timestamp. Después de cambiar schema, alguien con el proyecto linkeado hace `db push --linked`.

## Deploy

- Push a `main` → Vercel deploya la app.
- Cambios de Postgres **no** viajan con Vercel. Hay que pushear la migración a Supabase (como arriba).
- No hace falta `service_role` en el frontend. No commitees `.env.local`.

## Mapa rápido del código

```
app/(app)/          páginas logueadas (timeline, proyectos, horas, admin)
app/login/          Google OAuth
app/auth/callback/  intercambio del code de Auth
proxy.ts            sesión + redirects (en Next 16 ya no es middleware.ts)
lib/auth.ts         admin / pm / member
lib/audit.ts        withAudit() en cada mutación
app/(app)/*-actions.ts   server actions
supabase/migrations/
components/ui/      botones, fields, etc. (no hay shadcn)
```

UI en español. Textos de producto: Lector / Staff / Editor / Admin (en DB: `member` / `staff` / `pm` / `admin`).

## Si algo no arranca

| Síntoma | Qué mirar |
| --- | --- |
| Loop en `/login` | ¿Cuenta `@sociopublico.com`? ¿Abriste `localhost` y no `127.0.0.1`? |
| `Database error saving new user` | Trigger `private.handle_new_user`. Logs: Supabase → Postgres. Variables SQL no pueden llamarse `email`. |
| Cookies / sesión rara | Un solo host: `localhost:3000`. |
| Drive no lista archivos | Solo admin conecta Drive, en **Horas → Sync**. Scope `drive.readonly`. |
| Studio no abre | `npx supabase status` y Docker corriendo. |
