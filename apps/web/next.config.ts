import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los paquetes del monorepo se publican como TypeScript fuente.
  transpilePackages: ["@octopus/db", "@octopus/telemetry", "@octopus/ingest-core"],
  serverExternalPackages: ["ioredis", "postgres"],
};

export default nextConfig;
