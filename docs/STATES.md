# States

Estados de booking y transiciones permitidas.

## Estados
- pending: creada, aun no confirmada
- confirmed: aceptada y vigente
- cancelled: anulada
- expired: vencida por pasar el tiempo sin confirmacion

## Transiciones

| Desde     | Hacia     | Evento                               | Actor     | Permitida |
|-----------|-----------|--------------------------------------|-----------|-----------|
| pending   | confirmed | confirmacion de reserva              | admin     | si        |
| pending   | cancelled | cancelacion solicitada               | usuario   | si        |
| pending   | cancelled | cancelacion administrativa            | admin     | si        |
| pending   | expired   | vencimiento por tiempo               | sistema   | si        |
| confirmed | cancelled | cancelacion solicitada               | usuario   | si        |
| confirmed | cancelled | cancelacion administrativa            | admin     | si        |
| confirmed | expired   | paso del tiempo posterior al horario | sistema   | si        |

## Transiciones prohibidas
- cancelled -> confirmed
- cancelled -> pending
- expired -> confirmed
- expired -> pending
