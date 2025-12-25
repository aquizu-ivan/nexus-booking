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
 - Source: GitHub Actions (workflow `Deploy Pages`).
 - URL esperada: `https://aquizu-ivan.github.io/nexus-booking/`.
 - Configuracion GitHub: Settings -> Pages -> Source: GitHub Actions.
 - Variable requerida: `VITE_API_BASE_URL` en Settings -> Secrets and variables -> Actions -> Variables (o Environment `github-pages`).

Variables de entorno (prod):
- ADMIN_ACCESS_TOKEN (API, requerido para /admin)
- GIT_SHA (API, opcional para /health si Railway no provee SHA)
- RAILWAY_GIT_COMMIT_SHA (Railway, preferido si existe)
- API_PUBLIC_URL (API, opcional para /health expected.apiBase)
- PUBLIC_API_BASE (API, canónica para /health expected.apiBase, setear a `https://nexus-booking-nexus-booking.up.railway.app`)
- PUBLIC_WEB_BASE (API, opcional para /health expected.webBaseUrl)
- CORS_ORIGIN (API, allowlist): `http://localhost:5173,https://aquizu-ivan.github.io`

Git SHA en Pages (opcional):
- Si se quisiera mostrar en UI, exponer `VITE_GIT_SHA` desde Actions usando `GITHUB_SHA`.

Nota BOM (Windows):
- package.json y JSON criticos deben estar en UTF-8 sin BOM.
- Verificar BOM: `Get-Content -Encoding Byte -TotalCount 3 package.json`.
- Remover BOM (PowerShell):
  `$path = "package.json"; $content = Get-Content -Raw $path; [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))`
