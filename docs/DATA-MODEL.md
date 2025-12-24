# Data Model

Modelo logico conceptual. Sin detalle tecnico.

## users
Campos:
- id: identificador unico
- name: texto
- contact: texto (email o telefono)
- created_at: fecha y hora

Relaciones:
- un usuario tiene muchas reservas

Campos derivados:
- ninguno

## services
Campos:
- id: identificador unico
- name: texto
- description: texto
- duration_minutes: numero
- active: booleano
- created_at: fecha y hora

Relaciones:
- un servicio tiene muchas reservas
- un servicio tiene disponibilidad

Campos derivados:
- ninguno

## bookings
Campos:
- id: identificador unico
- user_id: referencia a users
- service_id: referencia a services
- start_at: fecha y hora
- status: texto controlado
- created_at: fecha y hora

Relaciones:
- una reserva pertenece a un usuario
- una reserva pertenece a un servicio

Campos derivados:
- end_at: calculado por start_at + duration del servicio

## availability
Campos:
- id: identificador unico
- service_id: referencia a services
- day_of_week: texto controlado
- start_time: hora
- end_time: hora
- active: booleano

Relaciones:
- la disponibilidad pertenece a un servicio

Campos derivados:
- ninguno
