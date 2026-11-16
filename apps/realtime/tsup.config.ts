import { defineConfig } from "tsup";

/** `noExternal` solo se puede configurar aquí (tsup no admite --noExternal por CLI). */
export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  noExternal: ["@octopus/telemetry"],
});
