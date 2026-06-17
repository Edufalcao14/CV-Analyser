import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    // Only unit-test the pure logic. The Next runtime / LLM calls are not unit-tested.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
