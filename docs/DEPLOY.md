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

GitHub Pages (web):
- Build: `pnpm -C apps/web run build -- --base=/nexus-booking/`
- Publicacion manual: subir `apps/web/dist` a la rama `gh-pages`.
- VITE_API_BASE_URL: setear en el entorno de build (Pages) con la URL de Railway.

Variables de entorno (prod):
- ADMIN_ACCESS_TOKEN (API, requerido para /admin)
