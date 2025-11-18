import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base:
    process.env.NODE_ENV === "production" ? "/construct-shader-graph/" : "/",
  assetsInclude: ["**/*.glsl", "**/*.wgsl"],
  server: {
    port: 3002,
    open: true,
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0, // Don't inline assets, keep them as separate files
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "preview/**/*",
          dest: "preview",
        },
        {
          src: "examples/**/*",
          dest: "examples",
        },
      ],
    }),
  ],
});
