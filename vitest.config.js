import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: false,
      include: ["tests/**/*.test.js"],
      setupFiles: ["./tests/setup.js"],
      testTimeout: 20000,
    },
  })
);
