# Octopus Track en una VPS propia

Despliega **todo el sistema** (web, ingesta GPS por TCP, tiempo real, base de
datos y Redis) en una sola VPS con Docker, con HTTPS automático y sin las
restricciones de puertos TCP que tienen plataformas como Fly.io en cuentas
nuevas.

## Requisitos

- Una VPS con Ubuntu o Debian (2 GB de RAM alcanza para empezar; DigitalOcean,
  Hetzner, Linode, Contabo, etc. — cualquiera sirve).
- Un dominio (o subdominio) con un registro **A** apuntando a la IP de la VPS.
  Necesario para que Caddy emita el certificado TLS automáticamente.
- Acceso root o sudo por SSH.

## Instalación

```bash
git clone https://github.com/AlanReyes9/Octopus-track.git
cd Octopus-track
bash deploy/vps/setup.sh
```

La primera vez el script solo crea `deploy/vps/.env` a partir de
`.env.example` y se detiene — edítalo (como mínimo `DOMAIN` y `ACME_EMAIL`) y
vuelve a correr el mismo comando. La segunda vez:

1. Instala Docker si falta.
2. Abre en el cortafuegos los puertos 80/443 (web) y **5023** (TCP de los
   rastreadores GPS).
3. Genera los secretos que dejaste en blanco (contraseña de la base de datos,
   `AUTH_SECRET`, `INGEST_TOKEN`, etc.) y la contraseña del administrador
   inicial — te la muestra al final, apúntala.
4. Construye las imágenes, aplica las migraciones y crea la cuenta de
   administrador.
5. Levanta todo con `docker compose` y agrega el cron diario de limpieza de
   datos antiguos.

Al terminar, la web queda en `https://<tu-dominio>` y los GPS se configuran
apuntando a `<tu-dominio>:5023` (TCP).

## Actualizar a una versión más nueva del código

```bash
git pull
bash deploy/vps/setup.sh
```

## Comandos útiles

```bash
# Logs de todo
docker compose -f deploy/vps/docker-compose.yml logs -f

# Logs de un servicio concreto
docker compose -f deploy/vps/docker-compose.yml logs -f ingest

# Reiniciar todo
docker compose -f deploy/vps/docker-compose.yml restart

# Apagar todo (los datos de la base y Redis quedan en los volúmenes de Docker)
docker compose -f deploy/vps/docker-compose.yml down
```

## Qué corre cada servicio

| Servicio   | Qué hace                                                         | Puerto expuesto         |
| ---------- | ----------------------------------------------------------------- | ----------------------- |
| `db`       | PostgreSQL 17 + TimescaleDB + PostGIS                              | interno                 |
| `redis`    | Pub/Sub para el mapa en vivo y notificaciones                      | interno                 |
| `migrate`  | Aplica migraciones y crea el admin inicial (se corre una sola vez) | —                        |
| `web`      | La app Next.js (panel, API REST, webhooks)                         | detrás de Caddy          |
| `ingest`   | Servicio TCP/HTTP que decodifica los protocolos GPS nativos        | **5023 (TCP, directo)** |
| `realtime` | Gateway WebSocket del mapa en vivo                                 | detrás de Caddy (`/realtime`) |
| `caddy`    | Proxy inverso con HTTPS automático (Let's Encrypt)                 | 80, 443                 |

## Notas de seguridad y mantenimiento

- Los backups de PostgreSQL **no** los hace este script: configura tú mismo
  copias regulares del volumen `pgdata` (o de un `pg_dump` programado).
- Las actualizaciones de seguridad del sistema operativo quedan a tu cargo
  (`apt update && apt upgrade`), a diferencia de un PaaS gestionado.
- Si cambias cualquier valor en `deploy/vps/.env`, vuelve a correr
  `docker compose -f deploy/vps/docker-compose.yml up -d` para aplicarlo.
