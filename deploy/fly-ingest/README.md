# Despliegue de apps/ingest en Fly.io

`apps/ingest` necesita un proceso persistente con socket TCP (Vercel no lo soporta).
Este `fly.toml` lo despliega como app `octopus-track-ingest`, con dos puertos:

- `4000` (HTTP): gateway JSON y futuras rutas HTTP de ingesta.
- `5023` (TCP crudo): autodetección de protocolo (GT06, Teltonika, TK103, GPS103, H02, Meitrack, `$POS`).

## Desplegar (desde la raíz del repo)

```bash
fly apps create octopus-track-ingest
fly secrets set DATABASE_URL=... -a octopus-track-ingest   # mismo valor que en Vercel
fly deploy -c deploy/fly-ingest/fly.toml --dockerfile apps/ingest/Dockerfile -a octopus-track-ingest
fly ips allocate-v6 -a octopus-track-ingest
fly ips allocate-v4 --yes -a octopus-track-ingest   # IP dedicada, $2/mes: imprescindible para TCP crudo
```

Una IPv4 **compartida** (gratis) solo enruta HTTP/HTTPS; el puerto TCP 5023 necesita la
dedicada sí o sí.

## Configurar la web para que muestre la dirección real

En Vercel (proyecto `octopus-track`), define:

- `NEXT_PUBLIC_INGEST_HOST=octopus-track-ingest.fly.dev` (o la IP dedicada)
- `NEXT_PUBLIC_INGEST_TCP_PORT=5023`

Así la página *Protocolos* deja de mostrar el placeholder `tu-servidor-de-ingesta`.
