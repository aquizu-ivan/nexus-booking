# QA Exhibicion

"Obra observable" en backend significa trazas verificables de health, status codes, y concurrencia, sin implementacion en TICKET-00.

Checklist TICKET-00:
- Estructura base creada (apps/, packages/, docs/).
- Docs base presentes.
- .env.example completo sin secretos.
- Tooling smoke sin DB real.

## DB shape ejecutable (FASE 2A)
- Verificacion: `pnpm run db:smoke`.
- Resultado esperado: schema aplicado con `db push` y seed minimo cargado.
- Sin migraciones: solo `db push`, sin historial.

## Backend observable — TICKET-03
- Verificacion rapida: `pnpm -C apps/api run api:smoke`.
- Alternativa manual: `pnpm -C apps/api run start` y luego `pnpm -C apps/api run health:smoke`.
- Observable en esta fase: proceso vivo, `/health` responde, error shape unico, uptime y timestamp.
- No se valida aun: DB, reglas de negocio, concurrencia, auth completa.

Regla: cada ticket debe dejar evidencia reproducible.
