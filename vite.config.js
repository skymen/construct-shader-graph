import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Plugin to provide a virtual module with example file list and contents
function examplesPlugin() {
  const virtualModuleId = "virtual:examples";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "examples-loader",
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        // Read all .c3sg files from examples directory
        const examplesDir = path.join(__dirname, "examples");
        const files = fs
          .readdirSync(examplesDir)
          .filter((f) => f.endsWith(".c3sg"));

        const examples = {};
        for (const file of files) {
          const filePath = path.join(examplesDir, file);
          const content = fs.readFileSync(filePath, "utf-8");
          examples[file] = content;
        }

        return `export default ${JSON.stringify(examples)};`;
      }
    },
  };
}

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
    examplesPlugin(),
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
