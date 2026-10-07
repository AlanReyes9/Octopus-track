# Avisos de terceros

El código de Octopus Track es original. Utiliza las siguientes dependencias de
código abierto, todas con licencias permisivas compatibles con uso comercial
(ninguna copyleft). Las licencias completas se distribuyen con cada paquete en
`node_modules/<paquete>/LICENSE`.

| Paquete | Licencia |
|---|---|
| next, react, react-dom | MIT |
| maplibre-gl | BSD-3-Clause |
| tailwindcss, tw-animate-css, tailwind-merge, clsx | MIT |
| @radix-ui/react-dialog, @radix-ui/react-slot | MIT |
| Componentes basados en shadcn/ui | MIT |
| lucide-react | ISC |
| class-variance-authority | Apache-2.0 |
| drizzle-orm | Apache-2.0 |
| postgres (Postgres.js) | Unlicense |
| fastify, @fastify/formbody | MIT |
| ws, ioredis, jose, zod, qrcode, server-only | MIT |
| bcryptjs | BSD-3-Clause |

## Datos y servicios

- Cartografía © colaboradores de OpenStreetMap (ODbL). La atribución se muestra en el mapa.
- Teselas: OpenFreeMap, esquema OpenMapTiles (atribución incluida en el estilo).
- Tipografía Inter (SIL Open Font License 1.1), servida por `next/font`.
- "Abrir en Google Maps" usa las Maps URLs públicas de Google (sin API ni contenido incrustado).

## Compatibilidad de protocolos

`/api/ingest/gateway` acepta el formato JSON `{ position, device }` que emiten
servidores de protocolos GPS externos al reenviar posiciones, y
`/api/ingest/osmand` acepta el protocolo HTTP OsmAnd. Solo se interpreta el
formato de datos (interoperabilidad); el proyecto no incluye ni distribuye código
de esos servidores.
