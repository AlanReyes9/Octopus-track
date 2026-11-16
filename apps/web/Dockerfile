# Construir desde la raíz del repo: docker build -f apps/web/Dockerfile .
# Objetivos:
#   runtime  (por defecto) -> sirve la app con `next start`
#   migrator               -> aplica migraciones + crea el admin inicial (packages/db db:deploy)
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

FROM build AS migrator
CMD ["pnpm", "--filter", "@octopus/db", "run", "db:deploy"]

FROM build AS webbuild
# build:app = solo `next build` (sin tocar la base de datos); las migraciones
# las aplica el servicio "migrate" de docker-compose antes de levantar la web.
RUN pnpm --filter @octopus/web run build:app \
 && pnpm --filter @octopus/web deploy --prod --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=webbuild /out ./
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
