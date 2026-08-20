# Gestión Socio

App interna para staffing, timelines y carga del equipo. Reemplaza el spreadsheet de proyectos en curso. Las horas / Toggl quedan para una etapa posterior.

## Stack

- Next.js (App Router)
- Supabase local (Postgres + Auth)
- Login con Google, solo `@sociopublico.com`

## Setup

1. Node 20+.
2. Docker (para `supabase start`).

### Login con Google

1. Credenciales OAuth de Google (tipo Web) con redirect `http://127.0.0.1:54321/auth/v1/callback` (local) y el callback de prod de Supabase.
2. En local abrí la app siempre en **`http://localhost:3000`** (no mezclar con `127.0.0.1:3000`: las cookies de sesión no se comparten entre esos hosts).
3. En Google Cloud → OAuth consent → Data Access, agregá también:
   - `https://www.googleapis.com/auth/drive.readonly`
4. En Vercel / `.env.local` de Next, además del Client ID, poné el **mismo** Client Secret como `GOOGLE_CLIENT_SECRET` (para renovar tokens de Drive en el server).
5. Si cambiaste `supabase/config.toml` (site_url / redirects), reiniciá Auth local: `npx supabase stop && npx supabase start`.

```bash
cp .env.example .env.local
# completar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET
# también en el entorno de supabase start:
export GOOGLE_CLIENT_ID=...
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...

npx supabase start
# copiar API URL y publishable key a .env.local

npm install
npm run dev
```

Solo admins ven **Drive** en el nav: ahí se conecta la cuenta que tiene acceso a la carpeta de horas (consent aparte del login normal).

El seed carga catálogos y workstreams en curso / pausado / mantenimiento desde el snapshot del spreadsheet.

## Roles de app

- `agustina@sociopublico.com` y `alejandra@sociopublico.com` → admin
- mails agregados en Usuarios → editor (escribe datos, no usuarios)
- resto del dominio → member (lectura)
