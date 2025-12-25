# API Contract

Contrato primero. Endpoints reales definidos a continuacion.

Error shape global:

```json
{ "ok": false, "error": { "code": "...", "message": "...", "details": null, "timestamp": "..." } }
```

## Publico

### GET /services
Respuesta 200:

```json
{
  "ok": true,
  "services": [
    {
      "id": 1,
      "name": "Servicio Demo",
      "description": "Servicio base",
      "duration_minutes": 60,
      "active": true,
      "created_at": "2025-01-01T09:00:00.000Z"
    }
  ]
}
```

### POST /services
Request:

```json
{
  "name": "Servicio Premium",
  "description": "Descripcion corta",
  "duration_minutes": 60,
  "active": true
}
```

Respuesta 201:

```json
{
  "ok": true,
  "service": {
    "id": 2,
    "name": "Servicio Premium",
    "description": "Descripcion corta",
    "duration_minutes": 60,
    "active": true,
    "created_at": "2025-01-02T10:00:00.000Z"
  }
}
```

### GET /availability?serviceId=&date=
Parametros:
- serviceId: integer
- date: YYYY-MM-DD (UTC)

Respuesta 200:

```json
{
  "ok": true,
  "service_id": 1,
  "date": "2025-12-29",
  "day_of_week": "monday",
  "slots": [
    { "id": 1, "start_time": "10:00", "end_time": "11:00" }
  ]
}
```

### POST /bookings
Request:

```json
{
  "user_id": 1,
  "service_id": 1,
  "start_at": "2025-12-29T10:00:00.000Z"
}
```

Respuesta 201:

```json
{
  "ok": true,
  "booking": {
    "id": 10,
    "user_id": 1,
    "service_id": 1,
    "start_at": "2025-12-29T10:00:00.000Z",
    "status": "pending",
    "created_at": "2025-12-24T15:00:00.000Z"
  }
}
```

Errores esperados:
- VALIDATION_ERROR (400): payload invalido o fecha en el pasado.
- NOT_FOUND (404): user_id o service_id inexistente.
- CONFLICT (409): fuera de disponibilidad, solapado, o colision por slot.

## Admin (X-ADMIN-TOKEN requerido)

Header requerido:
- X-ADMIN-TOKEN: <token>

### POST /admin/services
Igual a POST /services, pero requiere header admin.

### POST /admin/availability
Request:

```json
{
  "service_id": 1,
  "date": "2025-12-29",
  "start_time": "10:00",
  "end_time": "11:00",
  "active": true
}
```

Respuesta 201:

```json
{ "ok": true, "slot": { "id": 1 } }
```

### GET /admin/bookings?serviceId=&date=
Parametros:
- date: YYYY-MM-DD (UTC)
- serviceId: integer (opcional)

Respuesta 200:

```json
{ "ok": true, "bookings": [ { "id": 10, "status": "pending" } ] }
```

### POST /admin/bookings/:id/cancel
Respuesta 200:

```json
{ "ok": true, "booking": { "id": 10, "status": "cancelled" } }
```

Errores admin esperados:
- UNAUTHORIZED (401): falta X-ADMIN-TOKEN.
- FORBIDDEN (403): token invalido o no configurado.
