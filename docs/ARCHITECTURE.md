# Architecture

Forma de obra: Backend nucleo observable, Web instrumento humano, Admin gobernanza, Deploy organo explicito.

Topologia monorepo pnpm:
- apps/api
- apps/web
- packages/shared
- docs

Reglas:
- DB shape != migraciones (fase 2A vs 2B).
- El entorno manda: Windows-safe, comando unico canonico.
