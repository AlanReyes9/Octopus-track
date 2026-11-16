import { defineConfig } from "tsup";

/** `noExternal` solo se puede configurar aquí (tsup no admite --noExternal por CLI):
 *  empaqueta los paquetes del monorepo para que el contenedor no necesite node_modules. */
export default defineConfig({
  entry: ["src/main.ts", "src/simulator.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  noExternal: ["@octopus/db", "@octopus/telemetry", "@octopus/ingest-core"],
});
