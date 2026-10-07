# Construir desde la raíz del repo: docker build -f apps/realtime/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @octopus/realtime build \
 && pnpm --filter @octopus/realtime deploy --prod --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
EXPOSE 4001
CMD ["node", "dist/main.js"]
