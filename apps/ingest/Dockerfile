# Construir desde la raíz del repo: docker build -f apps/ingest/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @octopus/ingest build \
 && pnpm --filter @octopus/ingest deploy --prod --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
EXPOSE 4000 5023
CMD ["node", "dist/main.js"]
