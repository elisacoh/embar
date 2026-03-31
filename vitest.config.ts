import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30_000, // Supabase round-trips can be slow
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
