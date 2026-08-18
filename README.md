# Gestión Socio

App interna para staffing, timelines y carga del equipo. Reemplaza el spreadsheet de proyectos en curso. Las horas / Toggl quedan para una etapa posterior.

## Stack

- Next.js (App Router)
- Supabase local (Postgres + Auth)
- Login con Google, solo `@sociopublico.com`

## Setup

1. Node 20+.
2. Docker (para `supabase start`).
3. Credenciales OAuth de Google (tipo Web) con redirect `http://127.0.0.1:54321/auth/v1/callback`.

```bash
cp .env.example .env.local
# completar GOOGLE_CLIENT_ID y SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET
# también en el entorno de supabase start:
export GOOGLE_CLIENT_ID=...
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...

npx supabase start
# copiar API URL y publishable key a .env.local

npm install
npm run dev
```

El seed carga catálogos y workstreams en curso / pausado / mantenimiento desde el snapshot del spreadsheet.

## Roles de app

- `agustina@sociopublico.com` y `alejandra@sociopublico.com` → admin
- mails agregados en Usuarios → editor (escribe datos, no usuarios)
- resto del dominio → member (lectura)
