# Octopus Track

Plataforma SaaS **multi-empresa** para monitoreo de flotas y teléfonos en tiempo real: mapa en vivo con seguimiento, historial de rutas con reproducción, geocercas con alertas, comandos remotos, usuarios cliente de solo lectura y localización de teléfonos Android/iOS **con consentimiento**.

## Arquitectura

```
                ┌──────────── Equipos GPS ────────────┐
                │ Gateway JSON │ TCP $POS │ OsmAnd │ Teléfono (navegador)
                └──────┬─────────────────────┬────────┘
     HTTP              │                     │ TCP :5023
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
| `packages/telemetry` | Contrato `TelemetryEvent` normalizado, decodificadores (gateway JSON, OsmAnd, TCP `$POS`) y catálogo de comandos. Puro TS, sin BD ni UI. |
| `packages/db` | Migraciones SQL (TimescaleDB + PostGIS), esquema Drizzle, cliente `postgres.js`, seed. |
| `packages/ingest-core` | Pipeline de procesamiento (IMEI → posición → geocercas → Redis) y cola de comandos. Independiente del transporte. |
| `apps/ingest` | Servicio de ingesta de larga duración: HTTP (`/gateway`, `/osmand`) y socket TCP con entrega de comandos. |
| `apps/realtime` | Gateway WebSocket (`ws`) suscrito a Redis; reparte eventos por tenant. Escalable horizontalmente. |
| `apps/web` | Next.js (App Router) + Tailwind + shadcn/ui + MapLibre/OSM. UI, API REST y webhooks de ingesta serverless. |

### Modelo de datos

- `tenants`, `users`, `memberships(role: owner|admin|viewer)` — autenticación multi-empresa. `viewer` = **cliente**: solo ve las unidades asignadas en `user_vehicle_access`, sin poder registrar equipos ni enviar comandos.
- `devices` (`kind: gps|phone`; IMEI único global) y `vehicles` (asignación 1:1 opcional).
- `positions` — particionada por tiempo: **hipertabla TimescaleDB** si la extensión existe; si no (Supabase), **particionado nativo diario** mantenido con `pg_cron`. Coordenadas `DECIMAL(10, 7)`.
- `device_last_positions`, `geofences` (`geography(Polygon, 4326)` + GiST), `device_geofence_states`, `geofence_events`.
- `device_commands` (cola con estados `pending → sent → delivered/failed`), `consent_log` (aceptaciones y revocaciones de teléfonos).
- Row Level Security activado en todas las tablas sin políticas: la API pública de Supabase no expone datos; la app usa un rol propio con `BYPASSRLS`.

### Roles

| Rol | Ver mapa/historial | Geocercas | Vehículos / dispositivos | Comandos | Usuarios |
|---|---|---|---|---|---|
| Propietario | todo | crear/borrar | gestionar | sí | crear clientes y administradores |
| Administrador | todo | crear/borrar | gestionar | sí | crear clientes |
| Cliente | solo sus unidades | ver | — | — | — |

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

### Protocolos GPS (detección automática)

El servicio `apps/ingest` escucha en **un único puerto TCP (5023)** e identifica el protocolo por los primeros bytes de cada conexión. Al recibir datos de un IMEI registrado, la web actualiza el protocolo del dispositivo; si el IMEI aún no está registrado, queda anotado y la web lo reconoce al darlo de alta (búsqueda por IMEI exacto).

| Protocolo | Equipos típicos | Comandos |
|---|---|---|
| GT06 / Concox | Concox GT06N, Jimi, WeTrack, TK100 | posición, intervalo, bloqueo/desbloqueo, reinicio, personalizado (con respuesta del equipo) |
| Teltonika Codec 8 / 8E | FMB, FMC, FMM, FMT | posición, bloqueo (DOUT1), reinicio, personalizado (Codec 12, con respuesta) |
| GPS103 / Coban | TK103A/B, TK102B, GPS303 | posición, intervalo, bloqueo/desbloqueo, personalizado |
| TK103 | Xexun TK103 y clones | personalizado |
| H02 | Sinotrack ST-901/906 (texto) | personalizado |
| Meitrack | MVT, T1, T3xx | personalizado |
| Octopus `$POS` | Firmware propio | todos |

Puertos dedicados opcionales: `INGEST_PROTOCOL_PORTS="gt06:5023,teltonika:5027,gps103:5001"`.
Los decodificadores son código propio escrito a partir de las especificaciones públicas de cada fabricante (`packages/telemetry/src/protocols`) y tienen pruebas con tramas de ejemplo.

**Otras marcas** (Queclink, Suntech, CalAmp, Ruptela, JT808, …): mediante un servidor de protocolos de código abierto que reenvía a `/api/ingest/gateway` (ejemplo en `deploy/protocol-gateway`). Sus comandos se reenvían a `COMMANDS_WEBHOOK_URL`.

| Origen HTTP | Endpoint |
|---|---|
| Gateway JSON `{position, device}` | `POST https://<web>/api/ingest/gateway` con cabecera `X-Ingest-Token` |
| Apps con protocolo OsmAnd | `https://<web>/api/ingest/osmand?token=INGEST_TOKEN&id=IMEI&lat=..&lon=..` |
| Teléfono Android/iOS | Enlace `https://<web>/rastreo#t=…` generado en *Dispositivos → Teléfono* |

### Acciones de geocerca

En *Geocercas → ⚡ Acciones* cada zona puede tener reglas: **al entrar**, **al salir** o **ambos**, para cualquier unidad o una concreta, con acción **notificación push** o **comando** a la unidad que provoca el evento (`geofence_rules`, motor en `packages/ingest-core/src/automation.ts`). El bloqueo de motor nunca se ejecuta automáticamente.

### Notificaciones push

Web Push estándar (VAPID, RFC 8291/8292) implementado sin dependencias en `packages/ingest-core/src/webpush.ts`. Cada usuario las activa en *Mi cuenta* (o desde el aviso del mapa); llegan a administradores y a los clientes que ven esa unidad. En iPhone requieren instalar la web en la pantalla de inicio (iOS 16.4+). Genera las claves con:

```bash
pnpm --filter @octopus/ingest-core exec tsx -e 'import {generateVapidKeys} from "./src/webpush.ts"; console.log(generateVapidKeys())'
```

y define `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (también en `apps/ingest`).

### Teléfonos en segundo plano

Los navegadores pausan la geolocalización con la pantalla bloqueada. Tras aceptar el consentimiento, la página del teléfono muestra una URL personal `https://<web>/api/ingest/osmand/<token>` para configurar cualquier app de rastreo compatible con el protocolo OsmAnd (p. ej. Traccar Client, gratuita y de código abierto), que sí envía en segundo plano con el aviso del sistema. La URL solo acepta datos mientras el consentimiento esté vigente.

### Comandos predefinidos y personalizados

En el diálogo de comandos: pestaña **Predefinidos** (comandos integrados del protocolo + los guardados por la empresa en `command_templates`) y pestaña **Personalizado** (texto libre con la sintaxis del fabricante, con opción de guardarlo como predefinido, para un protocolo o para todos). El bloqueo de motor exige el vehículo detenido.

### Teléfonos con consentimiento

1. El administrador crea un dispositivo de tipo *Teléfono* y obtiene un enlace (y QR) de un solo uso visible.
2. La persona abre el enlace, ve qué empresa verá su ubicación, escribe su nombre y **acepta expresamente**.
3. La página envía la ubicación (Geolocation API) mientras está abierta, con indicador visible y botón **Dejar de compartir** que revoca el consentimiento.
4. Cada aceptación/revocación queda en `consent_log`. El token se guarda solo como hash SHA-256 y viaja en el fragmento `#` de la URL (no llega a registros de servidor).

Limitación de la plataforma: los navegadores (en especial iOS) pausan la geolocalización cuando la página se cierra o el teléfono se bloquea. Para seguimiento continuo en segundo plano hace falta una app nativa.

### Comandos

Catálogo en `packages/telemetry/src/commands.ts`: solicitar posición, intervalo de reporte, bloqueo/desbloqueo de motor (solo con el vehículo detenido ≤ 5 km/h y posición de < 10 min), reinicio, mensaje y comando libre.

- **TCP `$POS`**: el servicio de ingesta envía `$CMD,<id>,<tipo>,<k=v;…>*` al equipo conectado (o al reconectar) y espera `$CMDACK,<id>,OK|ERR[,msg]*`.
- **Gateway JSON**: la web hace `POST COMMANDS_WEBHOOK_URL` con `{ id, imei, type, params }` (Bearer `COMMANDS_WEBHOOK_TOKEN`).
- **Teléfono**: recibe solicitudes de posición y mensajes en su siguiente reporte.

## Despliegue

**Web → Vercel** (Root Directory `apps/web`, framework Next.js).

**Base de datos en Vercel (Neon, plan gratuito):** *Storage → Create Database → Neon* y conéctala al proyecto. En cada despliegue el build ejecuta `db:deploy`: aplica las migraciones con la URL directa (`DATABASE_URL_UNPOOLED`, también con prefijo, p. ej. `octopus_DATABASE_URL_UNPOOLED`) y, si la base está vacía, crea la empresa y el propietario con `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (contraseña temporal, se obliga a cambiarla). El mantenimiento diario (particiones y retención) lo hace Vercel Cron en `/api/cron/maintenance` (requiere `CRON_SECRET`).

Variables:

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | sí | PostgreSQL con PostGIS. Se aceptan también `octopus_DATABASE_URL` / `POSTGRES_URL` (integración Neon de Vercel). |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | primer despliegue | Propietario inicial si la base está vacía. |
| `CRON_SECRET` | sí con Vercel Cron | Protege `/api/cron/maintenance`. |
| `NEXT_PUBLIC_INGEST_HOST` / `NEXT_PUBLIC_INGEST_TCP_PORT` | no | Dirección del servicio TCP mostrada en *Protocolos*. |
| `AUTH_SECRET` | sí | Secreto de sesión (≥ 32 caracteres aleatorios). |
| `INGEST_TOKEN` | para ingesta | Token de `/api/ingest/gateway` y `/api/ingest/osmand`. |
| `COMMANDS_WEBHOOK_URL` / `COMMANDS_WEBHOOK_TOKEN` | no | Destino de comandos para equipos tipo gateway. |
| `NEXT_PUBLIC_LEGAL_*` | **sí, antes de operar** | Razón social, domicilio, correo de privacidad, país y jurisdicción mostrados en `/legal/*`. |
| `REDIS_URL` | para tiempo real | Redis accesible por TCP (Upstash `rediss://…`, etc.). |
| `REALTIME_JWT_SECRET` | para tiempo real | Compartido con `apps/realtime`. |
| `NEXT_PUBLIC_REALTIME_URL` | para tiempo real | `wss://` del gateway. Sin ella la UI usa polling cada 10 s. |
| `ALLOW_SIGNUP` | no | `false` (recomendado): solo el administrador crea usuarios. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | no | Estilo MapLibre propio. Por defecto OpenFreeMap (gratuito, uso comercial permitido). |

Migraciones: `DATABASE_URL=... pnpm db:migrate` (desde tu máquina o CI, con un rol con permisos DDL). `0003_retention.sql` programa el borrado diario de ubicaciones con más de 180 días.

**Ingesta TCP y gateway WebSocket** necesitan procesos persistentes (Vercel no admite sockets TCP ni WebSockets de larga duración). Hay `Dockerfile` en `apps/ingest` y `apps/realtime` para Fly.io, Railway, Render o cualquier VPS:

```bash
docker build -f apps/ingest/Dockerfile -t octopus-ingest .
docker build -f apps/realtime/Dockerfile -t octopus-realtime .
```

`apps/realtime` acepta `REALTIME_ALLOWED_ORIGINS` (lista separada por comas) para restringir el `Origin` de los navegadores.

## Aspectos legales

- Código y logotipo originales; dependencias con licencias permisivas: ver [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) y `/legal/licencias`.
- Páginas `/legal/privacidad`, `/legal/terminos` y `/legal/cookies` redactadas como plantilla (LFPDPPP de México / principios del RGPD). **Deben revisarlas un abogado de tu jurisdicción** y completarse con los datos `NEXT_PUBLIC_LEGAL_*`.
- Localización de personas solo con consentimiento expreso y revocable; los términos prohíben el rastreo encubierto.
- Retención automática de ubicaciones (180 días por defecto).
