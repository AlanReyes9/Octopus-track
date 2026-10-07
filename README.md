# Octopus Track

Plataforma SaaS **multi-empresa** para monitoreo GPS de flotas en tiempo real: mapa en vivo, historial de rutas con reproducción, geocercas con alertas de entrada/salida y telemetría.

## Arquitectura

```
                ┌──────────── Equipos GPS ────────────┐
                │ Traccar (200+ protocolos) │ TCP $POS │ OsmAnd
                └──────┬─────────────────────┬────────┘
     HTTP JSON forward │                     │ TCP :5023
                       ▼                     ▼
  ┌──────────────────────────────┐   ┌─────────────────────┐
  │ apps/web  /api/ingest/*      │   │ apps/ingest         │  Fastify + net
  │ (Vercel, serverless)         │   │ (Fly/Railway/VPS)   │
  └──────────────┬───────────────┘   └──────────┬──────────┘
                 └─────────┬────────────────────┘
                           ▼
              packages/ingest-core  (pipeline)
     IMEI→dispositivo · hipertabla · última posición · geocercas PostGIS
                 │                                │
                 ▼                                ▼
   PostgreSQL + TimescaleDB + PostGIS      Redis Pub/Sub  tenant:<id>:live
                 ▲                                │
                 │                                ▼
  ┌──────────────┴───────────────┐   ┌─────────────────────┐
  │ apps/web  (Next.js UI + API) │◄──│ apps/realtime (ws)  │  JWT por tenant
  └──────────────────────────────┘   └─────────────────────┘
```

| Paquete | Responsabilidad |
|---|---|
| `packages/telemetry` | Contrato `TelemetryEvent` normalizado y decodificadores (Traccar, OsmAnd, TCP `$POS`). Puro TS, sin BD ni UI. |
| `packages/db` | Migraciones SQL (TimescaleDB + PostGIS), esquema Drizzle, cliente `postgres.js`, seed. |
| `packages/ingest-core` | Pipeline de procesamiento: resolver IMEI, guardar, evaluar geocercas, publicar en Redis. Independiente del transporte. |
| `apps/ingest` | Servicio de ingesta de larga duración: HTTP (`/traccar`, `/osmand`) y socket TCP. |
| `apps/realtime` | Gateway WebSocket (`ws`) suscrito a Redis; reparte eventos por tenant. Escalable horizontalmente. |
| `apps/web` | Next.js (App Router) + Tailwind + shadcn/ui + MapLibre/OSM. UI, API REST y webhooks de ingesta serverless. |

### Modelo de datos

- `tenants`, `users`, `memberships(role: owner|admin|viewer)` — autenticación multi-empresa separada del resto.
- `devices` (IMEI único global, enruta la ingesta al tenant) y `vehicles` (asignación 1:1 opcional).
- `positions` — **hipertabla TimescaleDB** particionada por día, compresión columnar a los 7 días segmentada por `device_id`. Coordenadas `DECIMAL(10, 7)`.
- `device_last_positions` — última posición por dispositivo (lectura rápida del mapa).
- `geofences` — `geography(Polygon, 4326)` con índice GiST; `device_geofence_states` + `geofence_events` (hipertabla) para transiciones entrada/salida.

## Desarrollo local

```bash
docker compose up -d                 # Postgres (Timescale+PostGIS) y Redis
cp .env.example .env                 # y exporta las variables (o usa direnv)
pnpm install
pnpm db:migrate && pnpm db:seed      # usuario demo@octopus.track / demo1234
pnpm dev                             # web :3000, ingest :4000/:5023, realtime :4001
pnpm simulate                        # 3 vehículos enviando tramas TCP
```

Tests y comprobaciones: `pnpm test`, `pnpm typecheck`.

## Ingesta de telemetría

| Origen | Endpoint |
|---|---|
| Traccar forwarder (recomendado, 200+ protocolos) | `POST https://<web>/api/ingest/traccar?token=INGEST_TOKEN` o `POST http://<ingest>:4000/traccar` con header `X-Ingest-Token` |
| Traccar Client / OsmAnd | `https://<web>/api/ingest/osmand?token=INGEST_TOKEN&id=IMEI&lat=..&lon=..` |
| Socket TCP propio | `<ingest>:5023`, una trama por línea: `$POS,<imei>,<iso8601>,<lat>,<lon>,<kmh>,<rumbo>,<alt>,<sats>,<ign>*` → responde `$ACK,<imei>` |

Configuración de Traccar (`traccar.xml`):

```xml
<entry key='forward.enable'>true</entry>
<entry key='forward.json'>true</entry>
<entry key='forward.url'>https://TU-APP.vercel.app/api/ingest/traccar?token=INGEST_TOKEN</entry>
```

El `uniqueId` del dispositivo en Traccar debe coincidir con el IMEI registrado en Octopus Track.

## Despliegue

**Web → Vercel** (Root Directory `apps/web`, framework Next.js). Variables:

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | sí | PostgreSQL con PostGIS + TimescaleDB (p. ej. Timescale Cloud). Usa la URL del pooler. |
| `AUTH_SECRET` | sí | Secreto de sesión (≥ 32 caracteres aleatorios). |
| `INGEST_TOKEN` | para ingesta | Token de los webhooks `/api/ingest/*`. |
| `REDIS_URL` | para tiempo real | Redis accesible por TCP (Upstash `rediss://…`, etc.). |
| `REALTIME_JWT_SECRET` | para tiempo real | Compartido con `apps/realtime`. |
| `NEXT_PUBLIC_REALTIME_URL` | para tiempo real | `wss://` del gateway. Sin ella la UI usa polling cada 10 s. |
| `ALLOW_SIGNUP` | no | `false` para desactivar el registro público de empresas. |
| `NEXT_PUBLIC_MAP_TILES_URL` | no | Servidor de teselas propio (recomendado en producción; ver la política de uso de tile.openstreetmap.org). |

Migraciones: `DATABASE_URL=... pnpm db:migrate` (desde tu máquina o CI). Si el servidor no tiene TimescaleDB, la migración crea tablas normales y avisa con un `WARNING`.

**Ingesta TCP y gateway WebSocket** necesitan procesos persistentes (Vercel no admite sockets TCP ni WebSockets de larga duración). Hay `Dockerfile` en `apps/ingest` y `apps/realtime` para Fly.io, Railway, Render o cualquier VPS:

```bash
docker build -f apps/ingest/Dockerfile -t octopus-ingest .
docker build -f apps/realtime/Dockerfile -t octopus-realtime .
```

`apps/realtime` acepta `REALTIME_ALLOWED_ORIGINS` (lista separada por comas) para restringir el `Origin` de los navegadores.
