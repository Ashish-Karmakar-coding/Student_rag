import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["src/index.ts", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@study-tutor/shared": new URL(
        "../../packages/shared/src/index.ts",
        import.meta.url
      ).pathname,
    },
  },
});
