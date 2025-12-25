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

## Verificacion UX usuario final - TICKET-10
- Paso 1: Home carga, estado muestra API_BASE y ultima accion.
- Paso 2: Reservar -> elegir servicio + fecha -> buscar disponibilidad.
- Paso 3: Slots muestra loading, empty si no hay, o lista seleccionable.
- Paso 4: Confirmar reserva -> estado ok con ID.
- Estados a validar: loading, empty, error network, 400, 409, 500, success.

## Admin minimo - TICKET-11
- Setear ADMIN_ACCESS_TOKEN en entorno (no se commitea).
- Web: ir a #/admin, ingresar token en memoria.
- Crear servicio: form completo -> estado ok con ID.
- Crear disponibilidad: service_id + date + start/end -> estado ok.
- Ver reservas: date (y service_id opcional) -> lista o empty.
- Cancelar reserva: boton cancelar -> status actualizado.
- Estados a validar: 401/403, 400, 409, 500, success.

## Hotfix BOM - TICKET-12
- Verificar BOM: `Get-Content -Encoding Byte -TotalCount 3 package.json`.
- Resultado esperado: no debe ser `239 187 191` (UTF-8 BOM).
- Prisma sin BOM / JSON sin BOM: mantener archivos criticos sin BOM.

## Railway prestart - TICKET-12B
- Motivo: Railway ejecuta desde `apps/api`, no usar `pnpm -C apps/api` dentro de scripts.
- Fix: `prestart` usa `pnpm run deploy:prepare` y prisma corre desde cwd.
- Verificacion: `pnpm -C apps/api run deploy:prepare`.

## QA de exhibicion completa - TICKET-12
- Health: `curl https://nexus-booking-nexus-booking.up.railway.app/health` (200).
- Web: abrir `https://aquizu-ivan.github.io/nexus-booking/`.
- Home: carga y muestra API_BASE correcto.
- Services: lista servicios desde `/services`.
- Availability: devuelve slots para servicio y fecha.
- Booking: crea reserva y maneja 409.
- Admin: `#/admin` opera con token en memoria.
- Consola: limpia en produccion.

## Health metadata - TICKET-13
- Verificar identidad: `curl https://nexus-booking-nexus-booking.up.railway.app/health`.
- Confirmar: `gitSha`, `startedAt`, `node`, `expected` presentes.

## Git SHA real - TICKET-14
- Verificar: `gitSha` debe ser distinto de `unknown` cuando la env este configurada.

## expected.apiBase - TICKET-15
- Verificar: `/health` debe devolver `expected.apiBase` con `https://nexus-booking-nexus-booking.up.railway.app`.

Regla: cada ticket debe dejar evidencia reproducible.
