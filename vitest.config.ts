import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // Process entrypoints only bind a port. The app factory and handlers are what the tests call.
      include: ["src/**/*.ts", "api/**/*.ts"],
      exclude: ["src/stdio.ts", "src/http.ts"],
      thresholds: {
        lines: 85,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
