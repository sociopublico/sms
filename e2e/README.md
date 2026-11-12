# E2E (Playwright)

## Requisitos

- App en `http://localhost:3000`
- Supabase local levantado
- Sesión en `e2e/.auth/user.json` (no se versiona)

## Regenerar `storageState`

Con un usuario local existente (p. ej. admin):

```bash
SERVICE="$(npx supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY=//p' | tr -d '"')"
ANON="$(npx supabase status -o env | sed -n 's/^ANON_KEY=//p' | tr -d '"')"
EMAIL="agustina@sociopublico.com"

curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/generate_link" \
  -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"magiclink\",\"email\":\"$EMAIL\"}" > /tmp/sms-link.json

# Verificar token y armar cookies sb-127-auth-token (ver script en UX_AUDIT.md)
```

O iniciá sesión en el browser y exportá el storage con Playwright codegen / `page.context().storageState()`.

## Comandos

```bash
npm run test:e2e
npm run test:screenshots
```
