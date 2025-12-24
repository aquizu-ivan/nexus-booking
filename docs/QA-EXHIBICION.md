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

## Backend observable - TICKET-03
- Verificacion rapida: `pnpm -C apps/api run api:smoke`.
- Alternativa manual: `pnpm -C apps/api run start` y luego `pnpm -C apps/api run health:smoke`.
- Observable en esta fase: proceso vivo, `/health` responde, error shape unico, uptime y timestamp.
- No se valida aun: DB, reglas de negocio, concurrencia, auth completa.

## Contrato de errores - TICKET-04
- Verificacion: `pnpm -C apps/api run error:smoke`.
- Requiere seed local: `pnpm run db:smoke`.
- Tabla de errores:

| error code        | http | causa                          | ejemplo                       |
|-------------------|------|--------------------------------|-------------------------------|
| VALIDATION_ERROR  | 400  | payload invalido               | POST /bookings {}             |
| NOT_FOUND         | 404  | recurso inexistente            | GET /missing                  |
| CONFLICT          | 409  | conflicto de dominio           | POST /bookings (slot duplicado) |
| INTERNAL_ERROR    | 500  | excepcion no controlada        | error inesperado              |

## Concurrencia - TICKET-05
- Estrategia: constraint unico + manejo de error (colision -> CONFLICT).
- Que se demuestra: 1 reserva creada, el resto colisiona sin romper el proceso.
- Requiere DB local con seed: `pnpm run db:smoke`.
- Verificacion: `pnpm -C apps/api run concurrency:smoke`.
- Resultado esperado: 1x201 + N x 409.

## Deploy observable real - TICKET-06
- URL publica: `https://nexus-booking-nexus-booking.up.railway.app/health`.
- Verificacion: `curl https://nexus-booking-nexus-booking.up.railway.app/health`.
- Observable en prod: servicio responde 200 con `env=production`, uptime y timestamp.
- Boot seguro: `prisma generate` + `prisma migrate deploy`.

## FASE 2B - Migraciones canonicas
- Cambio vs FASE 2A: `db push` queda solo para DEV; prod usa `migrate deploy`.
- Comando oficial prod: `pnpm -C apps/api run db:migrate:deploy`.
- Estado de migraciones: `pnpm -C apps/api run db:migrate:status`.
- Evidencia viva: `https://nexus-booking-nexus-booking.up.railway.app/health`.
- Sin secretos en docs o repo.

## Dominio real - TICKET-08
- Requiere seed local: `pnpm run db:smoke`.
- Arranque local: `pnpm -C apps/api run start`.
- Verificacion manual (local):
  - Listar servicios:
    - `curl http://localhost:4000/services`
  - Crear servicio:
    - `curl -X POST http://localhost:4000/services -H "Content-Type: application/json" -d "{\"name\":\"Servicio X\",\"description\":\"Descripcion\",\"duration_minutes\":60,\"active\":true}"`
  - Consultar disponibilidad (fecha lunes):
    - `curl "http://localhost:4000/availability?serviceId=1&date=2025-12-29"`
  - Crear reserva valida:
    - `curl -X POST http://localhost:4000/bookings -H "Content-Type: application/json" -d "{\"user_id\":1,\"service_id\":1,\"start_at\":\"2025-12-29T10:00:00.000Z\"}"`
- Se valida: reglas basicas de dominio, conflicto por solapamiento/slot, shape de error.
- No se valida aun: cambios de estado, admin, reglas avanzadas.

## Web minima - TICKET-09
- DEV: `pnpm -C apps/web run dev`.
- Verificacion: Home carga, muestra API_BASE, Services lista servicios, Booking crea reserva.
- Requiere API local en `http://localhost:4000`.
- PROD: VITE_API_BASE_URL apunta a Railway en el build de Pages.

Regla: cada ticket debe dejar evidencia reproducible.
