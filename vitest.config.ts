import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"], coverage: { reporter: ["text", "json", "html"] } },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});

