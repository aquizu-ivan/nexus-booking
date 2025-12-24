# Deploy

Deploy es organo explicito. Estrategia placeholder:
- Web en GitHub Pages
- API en Railway
- DB en Neon

Estructura futura de documentacion (sin pasos en TICKET-00):
- Variables de entorno
- Build y artifacts
- Publicacion

Orden de arranque prod (sin secretos):
1) prisma generate
2) prisma migrate deploy
3) start
