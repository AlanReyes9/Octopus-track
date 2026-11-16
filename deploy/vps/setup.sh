#!/usr/bin/env bash
# Instala Octopus Track completo (web + ingesta TCP + tiempo real + base de
# datos + Redis + HTTPS automático) en una VPS limpia (Ubuntu/Debian).
#
# Uso, como root o con sudo, desde la raíz del repo ya clonado:
#   bash deploy/vps/setup.sh
#
# Puedes volver a correrlo: es seguro, no repite pasos ya hechos y aplica
# cambios nuevos de deploy/vps/.env si los editaste.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."   # raíz del repo
ENV_DIR="deploy/vps"
ENV_FILE="$ENV_DIR/.env"

echo "==> 1/5 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Falta el plugin 'docker compose'. Instala docker-compose-plugin y vuelve a correr este script." >&2
  exit 1
fi

echo "==> 2/5 Cortafuegos (80/443 HTTP/HTTPS, 5023 TCP para los GPS)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow 443/udp >/dev/null 2>&1 || true   # HTTP/3
  ufw allow 5023/tcp >/dev/null 2>&1 || true
fi

echo "==> 3/5 Variables de entorno (deploy/vps/.env)"
if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_DIR/.env.example" "$ENV_FILE"
  echo "Creado $ENV_FILE a partir de .env.example. EDÍTALO AHORA (dominio, correo, etc.) y vuelve a correr este script."
  exit 0
fi

gen_secret() { openssl rand -hex 32; }
fill_if_empty() {
  local key="$1"
  if ! grep -q "^${key}=.\+" "$ENV_FILE"; then
    local val; val=$(gen_secret)
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    echo "  generado ${key}"
  fi
}
fill_if_empty DB_PASSWORD
fill_if_empty AUTH_SECRET
fill_if_empty INGEST_TOKEN
fill_if_empty REALTIME_JWT_SECRET
fill_if_empty CRON_SECRET
if ! grep -q "^BOOTSTRAP_ADMIN_PASSWORD=.\+" "$ENV_FILE"; then
  pw=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)
  sed -i "s|^BOOTSTRAP_ADMIN_PASSWORD=.*|BOOTSTRAP_ADMIN_PASSWORD=${pw}|" "$ENV_FILE"
  echo "  contraseña inicial del administrador: ${pw}  (apúntala; te obligará a cambiarla al entrar)"
fi

# docker-compose no expande ${DOMAIN} dentro del propio .env, así que estas
# tres variables se resuelven aquí con el dominio real cada vez que corres el script.
DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "track.tu-dominio.com" ]; then
  echo "Falta configurar DOMAIN en $ENV_FILE (debe apuntar por DNS a la IP de esta VPS)." >&2
  exit 1
fi
sed -i "s|^NEXT_PUBLIC_REALTIME_URL=.*|NEXT_PUBLIC_REALTIME_URL=wss://${DOMAIN}/realtime|" "$ENV_FILE"
sed -i "s|^NEXT_PUBLIC_INGEST_HOST=.*|NEXT_PUBLIC_INGEST_HOST=${DOMAIN}|" "$ENV_FILE"

echo "==> 4/5 Construyendo imágenes y aplicando migraciones"
docker compose -f "$ENV_DIR/docker-compose.yml" --env-file "$ENV_FILE" build
docker compose -f "$ENV_DIR/docker-compose.yml" --env-file "$ENV_FILE" run --rm migrate

echo "==> 5/5 Levantando todos los servicios"
docker compose -f "$ENV_DIR/docker-compose.yml" --env-file "$ENV_FILE" up -d

CRON_SECRET_VAL=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2-)
CRON_LINE="15 3 * * * curl -fsS -H \"Authorization: Bearer ${CRON_SECRET_VAL}\" https://${DOMAIN}/api/cron/maintenance >/dev/null 2>&1"
( crontab -l 2>/dev/null | grep -v "/api/cron/maintenance" ; echo "$CRON_LINE" ) | crontab -
echo "  cron diario de mantenimiento (retención de datos) instalado a las 3:15 am"

cat <<EOF

Listo. Octopus Track corriendo en:
  Web:              https://${DOMAIN}
  Ingesta GPS (TCP): ${DOMAIN}:5023

Revisa que el dominio ya resuelva a la IP de esta VPS antes de entrar (si no,
Caddy no podrá emitir el certificado TLS y verás un error de conexión).

Para ver logs:        docker compose -f ${ENV_DIR}/docker-compose.yml logs -f
Para reiniciar todo:  docker compose -f ${ENV_DIR}/docker-compose.yml restart
Para actualizar:      git pull && bash ${ENV_DIR}/setup.sh
EOF
