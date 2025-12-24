# Domain Rules

## Que es una reserva
Una reserva es el compromiso de un usuario con un servicio en una fecha y horario especificos.

## Cuando una reserva es valida
- El servicio existe y esta activo.
- La fecha y horario estan dentro de la disponibilidad definida.
- El horario no esta tomado por otra reserva compatible.
- La reserva no esta en el pasado al momento de crearla.

## Que constituye un conflicto
- Dos reservas para el mismo servicio en el mismo horario.
- Una reserva fuera de los rangos de disponibilidad.
- Una reserva que se superpone con otra en el mismo servicio.

## Acciones prohibidas
- Reservar fechas en el pasado.
- Crear reservas fuera de disponibilidad.
- Duplicar reservas en el mismo horario.
- Cambiar manualmente estados a combinaciones no permitidas.

## Que puede hacer un usuario
- Ver servicios disponibles.
- Crear una reserva dentro de la disponibilidad.
- Consultar el estado de sus reservas.

## Que puede hacer un admin
- Crear y editar servicios.
- Definir y ajustar disponibilidad.
- Ver reservas y cambiar su estado dentro de las reglas.

## Que nunca hace el sistema
- Crear reservas sin un usuario asociado.
- Confirmar reservas que violan disponibilidad o conflicto.
- Alterar historicos para ocultar cambios de estado.
